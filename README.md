# Dns-Client-Efficient-Design

Dns-Client-Efficient-Design is a DNS query client designed to efficiently handle and process DNS queries. It supports querying different DNS record types and provides flexibility in input and output handling through various layers.

## Features

- Supports DNS record types: A, AAAA, CNAME, and MX
- Input handling via command line or file
- Output handling to console or file
- Persistence layer to store transaction IDs and responses
- Transport layer for sending DNS queries
- Validates domain names and query types

## Installation

1. Clone the repository:
    ```
    git clone https://github.com/Ali-Awais-Safdar/Dns-Client-Efficient-Design.git
    ```
2. Navigate to the project directory:
    ```
    cd Dns-Client-Efficient-Design
    ```

## Usage

### Command Line Interface (CLI)

To run a query directly from the command line:

```
node userInterface.js example.com A
```
### File Input
To run queries from a file:

Create a file with queries in the format domain queryType, one per line.
Run the script with the file name as an argument:

```
node userInterface.js queries.txt
```
### Output
The output will be displayed in the console by default. If a file input is provided, the results will be stored in 'output.txt'.

## File Structure

- 'userInterface.ts': Main entry point for handling user input and output.
- 'outputLayer.ts': Defines interfaces and classes for output handling (console and file).
- 'inputLayer.ts': Defines interfaces and classes for input handling (console and file).
- 'persistanceLayer.ts': Manages storage of transaction IDs and responses.
- 'transportLayer.ts': Handles sending DNS queries.
- 'createPacket.ts': Defines DNS packet creation and decoding.
