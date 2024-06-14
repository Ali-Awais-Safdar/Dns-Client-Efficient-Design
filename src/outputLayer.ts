import * as fs from 'fs';

interface IOutputLayer {
    displayOutput(message: string): void;
    storeOutput(data: string): Promise<void>;
}

class CLIOutputLayer implements IOutputLayer {
    displayOutput(message: string): void {
        console.log(message);
    }

    async storeOutput(data: string): Promise<void> {
        // No-op for CLI output
    }
}

class FileOutputLayer implements IOutputLayer {
    private filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    displayOutput(message: string): void {
        console.log(message);
    }

    async storeOutput(data: string): Promise<void> {
        await fs.promises.appendFile(this.filePath, data, 'utf8');
    }
    
}

export { IOutputLayer, CLIOutputLayer, FileOutputLayer}