// Function to check if the domain is valid
export function isValidDomain(domain: string): boolean {
	const domainRegex = /^(?!:\/\/)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;
	return domainRegex.test(domain);
}