export class Author {
    public readonly id: string;

    public constructor(id: string) {
        this.id = id;
    }
}

export class Branch {
    public readonly id: string;

    public constructor(id: string) {
        this.id = id;
    }
}

export default class Scene {
    public readonly id: string;
    private _authors: Author[] = [];
    private _branches: Map<string, Branch> = new Map();

    public constructor(id: string) {
        this.id = id;
    }

    public addBranch(branch: Branch) {
        this._branches.set(branch.id, branch);
    }

    public addAuthor(author: Author) {
        if (this._authors.find(a => a.id === author.id)) {
            return;
        }
        this._authors.push(author);
    }
}
