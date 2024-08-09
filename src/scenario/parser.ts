import Scene, {Author, Branch} from "@/scenario/scene.ts";

interface Reader {
    peek: (k?: number) => Promise<string>;
    read: (k?: number) => Promise<string>;
    isEOF: () => boolean;
}

export class BufferReader implements Reader {
    private readonly _source: string;

    private _pos: number = 0;

    public constructor(source: string) {
        this._source = source;
    }

    async peek(k: number = 1): Promise<string> {
        const start = this._pos;
        const end = this._pos + k;
        if (end > this._source.length) {
            throw new RangeError("k lies outside source buffer");
        }
        return this._source.substring(start, end);
    }

    async read(k: number = 1): Promise<string> {
        const s = this.peek(k);
        this._pos += k;
        return s;
    }

    public isEOF(): boolean {
        return this._pos >= this._source.length;
    }
}

enum TokenType {
    KEYWORD = "KEYWORD",
    COMMENT = "COMMENT",
    IDENTIFIER = "IDENTIFIER",
    STRING = "STRING",
    OPEN_BRACE = "OPEN_BRACE",
    CLOSE_BRACE = "CLOSE_BRACE",
}

const keywords = ["author", "scene", "branch", "jump"]

type Keyword = {
    type: TokenType.KEYWORD;
    value: "author" | "scene" | "branch" | "jump";
}

type Comment = {
    type: TokenType.COMMENT;
    value: string;
}

type Identifier = {
    type: TokenType.IDENTIFIER;
    value: string;
}

type String = {
    type: TokenType.STRING,
    value: string;
}

type OpenBrace = {
    type: TokenType.OPEN_BRACE;
    value: "{";
}

type CloseBrace = {
    type: TokenType.CLOSE_BRACE;
    value: "}";
}

type Token = Keyword | Comment | Identifier | String | OpenBrace | CloseBrace;

export class Lexer {
    private readonly _reader: Reader;

    public constructor(reader: Reader) {
        this._reader = reader;
    }

    protected async comment(): Promise<Comment> {
        // Check opening tag!
        if (await this._reader.peek() !== '#') {
            throw new SyntaxError("Expected #");
        }

        // Skip opening tag.
        await this._reader.read();

        let s = "";
        await this.eatWhitespace();

        while (!this._reader.isEOF()) {
            const c = await this._reader.peek();

            if (c === "\r" || c === "\n") {
                break;
            }

            s += await this._reader.read();
        }
        return {
            type: TokenType.COMMENT,
            value: s,
        }
    }

    protected isWhitespace(c: string): boolean {
        return c === " " || c === "\t" || c === "\n" || c === "\r";
    }

    protected async keywordOrIdentifier(): Promise<Keyword | Identifier> {
        let s = "";
        while (!this._reader.isEOF()) {
            const c = await this._reader.peek();

            if (this.isWhitespace(c)) {
                break;
            }

            s += await this._reader.read();
        }

        if (keywords.includes(s)) {
            return {
                type: TokenType.KEYWORD,
                value: s as Keyword['value'],
            }
        }

        return {
            type: TokenType.IDENTIFIER,
            value: s,
        }
    }

    protected async eatWhitespace() {
        while (!this._reader.isEOF()) {
            const c = await this._reader.peek();
            if (c === "\t" || c === " ") {
                await this._reader.read();
            } else {
                return;
            }
        }
    }

    protected async stringLiteral(): Promise<String> {
        // Check opening tag!
        if (await this._reader.peek() !== '"') {
            throw new SyntaxError("Expected \"");
        }

        // Skip opening tag.
        await this._reader.read();

        let s = "";
        while (!this._reader.isEOF()) {
            const c = await this._reader.peek();

            if (c === '\\') {
                await this._reader.read(); // consume the backslash
                s += await this._reader.read();
            }

            if (c === '"') {
                await this._reader.read(); // consume ending tag
                return {
                    type: TokenType.STRING,
                    value: s,
                }
            }

            // Ignore carriage returns (FUCK WINDOWS)
            if (c === "\r") {
                await this._reader.read();
                continue;
            }

            s += await this._reader.read();

            if (c === "\n" || c === " ") {
                await this.eatWhitespace();
            }
        }
        throw new Error("End of source");
    }

    public async nextToken(): Promise<Token | undefined> {
        while (!this._reader.isEOF()) {
            const c = await this._reader.peek();

            switch (c) {
                case '#':
                    await this.comment();
                    continue;

                case '"':
                    return this.stringLiteral();

                case '{':
                    return {
                        type: TokenType.OPEN_BRACE,
                        value: await this._reader.read() as "{",
                    };

                case '}':
                    return {
                        type: TokenType.CLOSE_BRACE,
                        value: await this._reader.read() as "}",
                    };

                case ' ':
                case '\t':
                case '\r':
                case '\n':
                    await this._reader.read();
                    continue;

                default:
                    return this.keywordOrIdentifier();
            }
        }

        return undefined;
    }
}

export class Parser {
    private readonly _lexer: Lexer;

    public constructor(lexer: Lexer) {
        this._lexer = lexer;
    }

    protected async branch(scene: Scene): Promise<void> {
        let token = await this._lexer.nextToken();
        if (token === undefined || token.type !== TokenType.IDENTIFIER) {
            throw new SyntaxError(`Expected identifier, got '${token?.type}'`);
        }

        const branch = new Branch(token.value);

        while ((token = await this._lexer.nextToken()) !== undefined) {
            if (token.type === TokenType.CLOSE_BRACE) {
                scene.addBranch(branch);
                return;
            }
        }
    }

    protected async scene(): Promise<Scene> {
        const authors: Author[] = [];

        let token = await this._lexer.nextToken();
        if (token === undefined || token.type !== TokenType.IDENTIFIER) {
            throw new SyntaxError(`Expected IDENTIFIER, got ${token?.type}`);
        }

        const scene = new Scene(token.value);

        token = await this._lexer.nextToken();
        if (token === undefined || token.type !== TokenType.OPEN_BRACE) {
            throw new SyntaxError(`Expected OPEN_BRACE, got ${token?.type}`);
        }

        while ((token = await this._lexer.nextToken()) !== undefined) {
            if (token.type === TokenType.KEYWORD) {
                switch (token.value) {
                    case "author": {
                        const author = await this.author();
                        authors.push(author);
                        continue;
                    }

                    case "branch": {
                        await this.branch(scene);
                        continue;
                    }
                }
            }

            if (token.type === TokenType.CLOSE_BRACE) {
                authors.forEach(a => scene.addAuthor(a));
                return scene;
            }
        }
        throw new SyntaxError("Expected CLOSE_BRACE but reached EOF");
    }

    protected async author(): Promise<Author> {
        let token = await this._lexer.nextToken();
        if (token === undefined || token.type !== TokenType.IDENTIFIER) {
            throw new SyntaxError(`Expected IDENTIFIER, got ${token?.type}`);
        }

        const author = new Author(token.value);
        while ((token = await this._lexer.nextToken()) !== undefined) {
            if (token.type === TokenType.CLOSE_BRACE) {
                return author;
            }
        }

        throw new SyntaxError("Expected CLOSE_BRACE but reached EOF");
    }

    public async parse(): Promise<Scene[]> {
        let token: Token | undefined = undefined;
        const scenes: Scene[] = [];
        const authors: Author[] = [];

        while ((token = await this._lexer.nextToken()) !== undefined) {
            switch (token.type) {
                case TokenType.KEYWORD: {
                    switch (token.value) {
                        case "author": {
                            const author = await this.author();
                            authors.push(author);
                            break;
                        }

                        case "scene": {
                            const scene = await this.scene();
                            scenes.push(scene);
                            break;
                        }

                        default:
                            throw new Error(`Expected keyword 'author' or 'scene', got '${token.value}'`);
                    }
                    break;
                }

                default:
                    throw new Error(`Unexpected token type '${token.type}'`);
            }
        }

        authors.forEach(a => scenes.forEach(s => s.addAuthor(a)));
        return scenes;
    }
}
