import * as core from '@actions/core'
import AuthorizationManager from '../authorization/authorizationManager';

// Parent class to manage common Spacelift environment setup
class TerraformManager {
  protected authorizationManager: AuthorizationManager;

  constructor() {
    this.authorizationManager = new AuthorizationManager();  // Initialize the AuthorizationManager
  }
}

export default TerraformManager
