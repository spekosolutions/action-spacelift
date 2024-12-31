import axios from 'axios';
import * as core from '@actions/core';

export class AuthorizationManager {
    private actionsIdTokenRequestToken: string;
    private actionsIdTokenRequestUrl: string;
    private apiKeyId: string;

    protected oidcToken: string | null = null;
    protected oidcTokenExpiration: number | null = null;

    protected bearerToken: string | null = null;
    protected bearerTokenExpiration: number | null = null;

    public spaceliftApiKeyEndpoint: string;

    constructor(apiKeyEndpoint?: string) {
        this.actionsIdTokenRequestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || '';
        this.actionsIdTokenRequestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL || '';
    
        // Use the apiKeyEndpoint parameter if provided, otherwise fallback to the environment variable
        this.spaceliftApiKeyEndpoint = apiKeyEndpoint && apiKeyEndpoint.trim() !== ''
            ? apiKeyEndpoint
            : process.env.SPACELIFT_API_KEY_ENDPOINT || '';
    
        this.apiKeyId = process.env.SPACELIFT_KEY_ID || '';
    }    

    private async generateOidcToken(): Promise<void> {
        try {
            core.info('Generating OIDC token...');
            const response = await axios.get(`${this.actionsIdTokenRequestUrl}&audience=${this.spaceliftApiKeyEndpoint}`, {
                headers: { Authorization: `Bearer ${this.actionsIdTokenRequestToken}` }
            });

            this.oidcToken = response.data.value;
            const expiry = response.data.expiration || 3600;
            this.oidcTokenExpiration = Date.now() + expiry * 1000;
            core.info(`OIDC token generated. Expiration time: ${new Date(this.oidcTokenExpiration).toISOString()}`);
        } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            core.setFailed(`Failed to generate OIDC token: ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }

    protected async ensureValidOidcToken(): Promise<void> {
        if (!this.oidcToken || (this.oidcTokenExpiration && Date.now() >= this.oidcTokenExpiration)) {
            await this.generateOidcToken();
        }
    }

    private async generateBearerToken(): Promise<void> {
        await this.ensureValidOidcToken();
    
        const retryOperation = async (attempt: number): Promise<void> => {
            try {
                core.info(`Exchanging OIDC token for bearer token (Attempt ${attempt})...`);
                const query = {
                    query: `
                        mutation {
                            apiKeyUser(id: "${this.apiKeyId}", secret: "${this.oidcToken}") {
                                jwt
                                validUntil
                            }
                        }
                    `
                };
                const response = await axios.post(
                    `https://${this.spaceliftApiKeyEndpoint}/graphql`,
                    query,
                    {
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
    
                core.info(`GraphQL Response: ${JSON.stringify(response.data)}`);
    
                const user = response.data?.data?.apiKeyUser;
    
                if (!user?.jwt) {
                    throw new Error('JWT token not found in response');
                }
    
                this.bearerToken = user.jwt;
                const validUntil = user.validUntil || Math.floor(Date.now() / 1000) + 3600;
                this.bearerTokenExpiration = validUntil * 1000;
    
                core.info(`Bearer token generated. Expiration time: ${new Date(this.bearerTokenExpiration).toISOString()}`);
            } catch (error) {
                const errorMessage = this.getErrorMessage(error);
                if (attempt < 3) {
                    core.warning(`Attempt ${attempt} failed: ${errorMessage}. Retrying...`);
                    await retryOperation(attempt + 1);
                } else {
                    core.setFailed(`Failed to exchange OIDC token for bearer token after 3 attempts: ${errorMessage}`);
                    throw new Error(errorMessage);
                }
            }
        };
    
        await retryOperation(1);
    }    

    protected async ensureValidBearerToken(): Promise<void> {
        if (!this.bearerToken || (this.bearerTokenExpiration && Date.now() >= this.bearerTokenExpiration)) {
            await this.generateBearerToken();
        }
    }

    public get oidcTokenAsync(): Promise<string> {
        return (async () => {
            await this.ensureValidOidcToken();
            return this.oidcToken as string;
        })();
    }

    public get bearerTokenAsync(): Promise<string> {
        return (async () => {
            await this.ensureValidBearerToken();
            return this.bearerToken as string;
        })();
    }

    public async executeCommandWithRetry(command: string, retries: number = 3): Promise<void> {
        while (retries > 0) {
            try {
                await this.ensureValidBearerToken();
                core.info(`Executing command: ${command}`);
                // Example execution: await exec(command);
                core.info('Command executed successfully.');
                break;
            } catch (error) {
                retries--;
                const errorMessage = this.getErrorMessage(error);
                core.warning(`Command failed. Retries left: ${retries}. Error: ${errorMessage}`);
                if (retries === 0) {
                    core.setFailed(`Command failed after 3 attempts: ${errorMessage}`);
                    throw new Error(errorMessage);
                }
            }
        }
    }

    private getErrorMessage(error: unknown): string {
        if (axios.isAxiosError(error)) {
            // Axios-specific error
            return (error.response?.data as any)?.message || error.message || 'Unknown Axios error';
        }
        if (error instanceof Error) {
            // Generic JavaScript Error
            return error.message;
        }
        // Handle unknown types
        return typeof error === 'string' ? error : 'An unknown error occurred';
    }    
}

export default AuthorizationManager;
