interface IOutputLayer {
    displayOutput(message: string): void;
    storeOutput(data: string): Promise<void>;
}
declare class CLIOutputLayer implements IOutputLayer {
    displayOutput(message: string): void;
    storeOutput(data: string): Promise<void>;
}
declare class FileOutputLayer implements IOutputLayer {
    private filePath;
    constructor(filePath: string);
    displayOutput(message: string): void;
    storeOutput(data: string): Promise<void>;
}
export { IOutputLayer, CLIOutputLayer, FileOutputLayer };
