import * as fs from 'fs';

interface IInputLayer {
    getInput(): Promise<string[]>;
}

class CLIInputLayer implements IInputLayer {
    async getInput(): Promise<string[]> {
        const input = process.argv.slice(2).join(' ');
        return [input];
    }
}

class FileInputLayer implements IInputLayer {
    private filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    async getInput(): Promise<string[]> {
        const data = await fs.promises.readFile(this.filePath, 'utf8');
        return data.trim().split('\n');
    }
}

export {IInputLayer, CLIInputLayer, FileInputLayer}