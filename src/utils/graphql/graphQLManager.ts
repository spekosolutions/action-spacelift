import axios from 'axios'
import * as core from '@actions/core'
import AuthorizationManager from '../authorization/authorizationManager';

class GraphQLManager {
  private authorizationManager: AuthorizationManager;


  constructor() {
    this.authorizationManager = new AuthorizationManager();  // Initialize the AuthorizationManager
  }
  
  // Send GraphQL request with Bearer token
  protected async sendRequest(mutation: any): Promise<any> {
    try {
      const bearerToken = await this.authorizationManager.bearerTokenAsync;  // Retrieve Bearer token
      const response = await axios.post(`https://${this.authorizationManager.spaceliftApiKeyEndpoint}/graphql`, mutation, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.errors) {
        throw new Error(JSON.stringify(response.data.errors));
      }

      return response.data?.data;
    } catch (error) {
      core.setFailed(`Failed to execute GraphQL request: ${(error as Error).message}`);
      throw error;
    }
  }
}

export default GraphQLManager
