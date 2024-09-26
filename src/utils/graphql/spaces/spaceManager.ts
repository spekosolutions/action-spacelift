import GraphQLManager from '../graphQLManager'
import * as core from '@actions/core'

class SpaceManager extends GraphQLManager {
  constructor() {
    super()
  }

  // Method to create service space with clear distinction for existing space
  async createServiceSpace(inputs: any): Promise<string> {
    const { label_prefix, env, region, service_name, label_postfix } = inputs
    const label = `${label_prefix}:${env}:${region}:${service_name}:${label_postfix}`
    const labelParts = label.split(':')

    let parentId: string | undefined = undefined
    let isNewSpaceCreated = false // Flag to check if new space was created

    try {
      // Iterate over the label parts to create spaces in the hierarchy
      for (let i = 0; i < labelParts.length; i++) {
        const currentLabel = labelParts.slice(0, i + 1).join(':')
        const existingSpace = await this.findSpaceByLabel(currentLabel)

        if (existingSpace) {
          core.info(`Space for ${currentLabel} already exists with ID: ${existingSpace.id}`)
          parentId = existingSpace.id // Set parentId for the next iteration
        } else {
          // If no existing space, create a new one
          if (i > 0 && !parentId) {
            throw new Error(`Parent ID is not set for label: ${currentLabel}.`)
          }

          parentId = await this.createSpace(currentLabel, labelParts[i], parentId)
          core.info(`New space created with ID: ${parentId}`)
          isNewSpaceCreated = true // Mark that a new space was created
        }
      }

      // Final message depending on whether the space was newly created or already existed
      if (isNewSpaceCreated) {
        core.info(`Successfully created new service space with ID: ${parentId}`)
      } else {
        core.info(`No new space created. Using existing space with ID: ${parentId}`)
      }

      return parentId!
    } catch (error) {
      // Enhanced error handling
      if ((error as any).response && (error as any).response.data) {
        core.error(`Failed to create service space: ${JSON.stringify((error as any).response.data)}`)
      } else {
        core.error(`Unexpected error occurred: ${(error as Error).message}`)
      }
      throw error
    }
  }

  // Method to create a space
  async createSpace(label: string, serviceName: string, parentId?: string): Promise<string> {
    core.info(`Creating space with label: ${label}`)

    const mutation = {
      query: `mutation CreateSpace($input: SpaceInput!) {
        spaceCreate(input: $input) {
          id
          name
          labels
        }
      }`,
      variables: {
        input: {
          name: serviceName,
          parentSpace: parentId || 'root',
          description: `${serviceName} space for ${label}`,
          inheritEntities: true,
          labels: [label],
        },
      },
    }

    const response = await this.sendRequest(mutation)
    const spaceId = response.spaceCreate.id
    core.info(`New space created with ID: ${spaceId}`)
    return spaceId
  }

  // Method to find space by label with logging and error handling
  async findSpaceByLabel(label: string): Promise<any | null> {
    try {
      core.info(`Fidning space with label: ${label}`)
      // Query spaces
      const spaces = await this.querySpaces()

      //   // Log the spaces result for debugging
      //   core.info(`Queried spaces: ${JSON.stringify(spaces, null, 2)}`)

      // Find space that matches the label
      const foundSpace = spaces.find((space: any) => space.labels.includes(label)) || null

      // Log the result of the space found
      if (foundSpace) {
        core.info(`Space found for label '${label}': ${JSON.stringify(foundSpace)}`)
      } else {
        core.info(`No space found for label '${label}'.`)
      }

      return foundSpace
    } catch (error) {
      // Log any errors that occur during the query
      core.error(`Error finding space by label '${label}': ${(error as Error).message}`)
      throw error // Rethrow the error to handle it upstream
    }
  }

  // Method to query spaces
  async querySpaces(): Promise<any[]> {
    const query = {
      query: `query {
        spaces {
          id
          name
          labels
          parentSpace
        }
      }`,
    }

    const response = await this.sendRequest(query)
    return response.spaces
  }
}

export default SpaceManager
