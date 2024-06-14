interface IInputLayer {
    getInput(): Promise<string[]>;
}
declare class CLIInputLayer implements IInputLayer {
    getInput(): Promise<string[]>;
}
declare class FileInputLayer implements IInputLayer {
    private filePath;
    constructor(filePath: string);
    getInput(): Promise<string[]>;
}
export { IInputLayer, CLIInputLayer, FileInputLayer };
