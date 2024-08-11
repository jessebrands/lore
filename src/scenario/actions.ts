import {Action} from "@/core/action.ts";

export class TextAction implements Action {
    public readonly text: string;

    public constructor(text: string) {
        this.text = text;
    }

    public execute() {
        // Do nothing for now!!
    }
}

export class JumpAction implements Action {
    public readonly label: string;

    public constructor(label: string) {
        this.label = label;
    }

    public execute() {
        // Do nothing for now!!
    }
}
