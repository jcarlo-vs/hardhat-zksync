import {
    DockerBadGatewayError,
    DockerHubConnectionError,
    DockerNotRunningError,
    DockerServerError,
    HardhatDocker,
    Image,
    ImageDoesntExistError,
    ProcessResult,
  } from "@nomiclabs/hardhat-docker";
import { ProjectPathsConfig, CompilerInput } from "hardhat/types";
import path from "path";
import { ZkSolcConfig } from "../types";

import { pluginError } from "../utils";

// Notice: contents of this file were mostly copy-pasted from the
// official Hardhat Vyper plugin: https://github.com/nomiclabs/hardhat/tree/master/packages/hardhat-vyper

export function dockerImage(imageName?: string): Image {
  if (!imageName) {
    throw pluginError("Docker source was chosen but no image was specified");
  }

  return {
    repository: imageName,
    tag: "latest"
  }
}

export async function validateDockerIsInstalled() {
  if (!(await HardhatDocker.isInstalled())) {
    throw pluginError(
      `Docker Desktop is not installed.
Please install it by following the instructions on https://www.docker.com/get-started`
    );
  }
}


export async function createDocker(): Promise<HardhatDocker> {
  return await handleCommonErrors(HardhatDocker.create());
}

export async function pullImageIfNecessary(
  docker: HardhatDocker,
  image: Image
) {
  await handleCommonErrors(pullImageIfNecessaryInner(docker, image));
}

async function pullImageIfNecessaryInner(
  docker: HardhatDocker,
  image: Image,
) {
  if (!(await docker.hasPulledImage(image))) {
    console.log(
      `Pulling Docker image ${HardhatDocker.imageToRepoTag(image)}...`
    );

    await docker.pullImage(image);

    console.log(`Image pulled`);
  } else {
    await checkForImageUpdates(docker, image);
  }
}

async function checkForImageUpdates(
  docker: HardhatDocker,
  image: Image
) {
  if (!(await docker.isImageUpToDate(image))) {
    console.log(
      `Updating Docker image ${HardhatDocker.imageToRepoTag(image)}...`
    );

    await docker.pullImage(image);

    console.log(`Image updated`);
  }
}

export async function compileWithDocker(
  input: CompilerInput,
  docker: HardhatDocker,
  dockerImage: Image,
  config: ZkSolcConfig,
): Promise<any> {
  const zksolcCommand = ["zksolc", "--standard-json"];
  if (config?.settings?.optimizer?.enabled) {
    zksolcCommand.push("--optimize");
  }
  // TODO: pass the input into docker

  const result = handleCommonErrors(docker.runContainer(
    dockerImage,
    zksolcCommand,
  ));
}

async function handleCommonErrors<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (
      error instanceof DockerNotRunningError ||
      error instanceof DockerBadGatewayError
    ) {
      throw pluginError(
        "Docker Desktop is not running.\nPlease open it and wait until it finishes booting.",
        error
      );
    }

    if (error instanceof DockerHubConnectionError) {
      throw pluginError(
        `Error connecting to Docker Hub.
Please check your internet connection.`,
        error
      );
    }

    if (error instanceof DockerServerError) {
      throw pluginError(
        "Docker error",
        error
      );
    }

    if (error instanceof ImageDoesntExistError) {
      throw pluginError(
        `Docker image ${HardhatDocker.imageToRepoTag(
          error.image
        )} doesn't exist.
Make sure you chose a valid Vyper version.`
      );
    }

    throw error;
  }
}
