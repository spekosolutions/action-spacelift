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
    
    constructor() {
        this.actionsIdTokenRequestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || '';
        this.actionsIdTokenRequestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL || '';
        this.spaceliftApiKeyEndpoint = process.env.SPACELIFT_API_KEY_ENDPOINT || '';
        this.apiKeyId = process.env.SPACELIFT_KEY_ID || '';
    }

    // Generates an OIDC token and saves it along with its expiration time
    private async generateOidcToken(): Promise<void> {
        try {
            core.info('Generating OIDC token...');
            const response = await axios.get(`${this.actionsIdTokenRequestUrl}&audience=${this.spaceliftApiKeyEndpoint}`, {
                headers: { Authorization: `Bearer ${this.actionsIdTokenRequestToken}` }
            });

            this.oidcToken = response.data.value;
            // Assuming the OIDC token expiration is typically one hour (3600 seconds)
            this.oidcTokenExpiration = Date.now() + 3600 * 1000;
        } catch (error) {
            core.setFailed(`Failed to generate OIDC token: ${error}`);
            throw error;
        }
    }

    // Ensures the OIDC token is valid, generates a new one if expired
    protected async ensureValidOidcToken(): Promise<void> {
        if (!this.oidcToken || (this.oidcTokenExpiration && Date.now() >= this.oidcTokenExpiration)) {
            await this.generateOidcToken();
        }
    }

    // Exchanges the OIDC token for a Bearer token and saves it along with its expiration time
    private async generateBearerToken(): Promise<void> {
        await this.ensureValidOidcToken();
        try {
            core.info('Exchanging OIDC token for bearer token...');
            const query = {
                query: `mutation { apiKeyUser(id: "${this.apiKeyId}", secret: "${this.oidcToken}") { jwt }}`
            };
            const response = await axios.post(`https://${this.spaceliftApiKeyEndpoint}/graphql`, query, {
                headers: { 'Content-Type': 'application/json' }
            });

            this.bearerToken = response.data.data.apiKeyUser.jwt;
            // Assuming the Bearer token expiration is typically one hour (3600 seconds)
            this.bearerTokenExpiration = Date.now() + 3600 * 1000;
        } catch (error) {
            core.setFailed(`Failed to exchange OIDC token for bearer token: ${error}`);
            throw error;
        }
    }

    // Ensures the Bearer token is valid, generates a new one if expired
    protected async ensureValidBearerToken(): Promise<void> {
        if (!this.bearerToken || (this.bearerTokenExpiration && Date.now() >= this.bearerTokenExpiration)) {
            await this.generateBearerToken();
        }
    }

    // Getter for OIDC token that ensures the token is valid
    public get oidcTokenAsync(): Promise<string> {
        return (async () => {
            await this.ensureValidOidcToken();
            return this.oidcToken as string;
        })();
    }

    // Getter for Bearer token that ensures the token is valid
    public get bearerTokenAsync(): Promise<string> {
        return (async () => {
            await this.ensureValidBearerToken();
            return this.bearerToken as string;
        })();
    }
}

export default AuthorizationManager