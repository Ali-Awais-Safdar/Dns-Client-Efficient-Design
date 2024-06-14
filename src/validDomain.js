"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidDomain = void 0;
// Function to check if the domain is valid
function isValidDomain(domain) {
    const domainRegex = /^(?!:\/\/)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;
    return domainRegex.test(domain);
}
exports.isValidDomain = isValidDomain;
