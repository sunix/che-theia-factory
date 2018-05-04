/*
 * Copyright (c) 2018-2018 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { injectable, inject } from "inversify";
import { MessageService } from "@theia/core/lib/common";
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { EnvVariablesServer } from "@theia/core/lib/common/env-variables";
import { Resources } from "./resources";
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Git, Repository } from "@theia/git/lib/common";
import { IFactory } from "./types.d"
import { IProjectConfig } from "@eclipse-che/workspace-client";

const queryString = require('query-string');

@injectable()
export class FactoryTheiaClient implements FrontendApplicationContribution {

    private static axiosInstance: AxiosInstance = axios;

    constructor(
        @inject(MessageService) private readonly messageService: MessageService,
        @inject(EnvVariablesServer) private readonly envVariablesServer: EnvVariablesServer,
        @inject(Git) protected readonly git: Git,
    ) { }

    onStart(app: FrontendApplication): void {
        const factoryid = queryString.parse(window.location.search)['factory-id'];

        if (!factoryid) {
            return;
        }

        this.envVariablesServer.getVariables().then((envVariables) => {


            const cheApiExternalVar = envVariables.find(function(envVariable) { return envVariable.name === 'CHE_API_EXTERNAL' });
            const projectsRootEnvVar = envVariables.find(function(envVariable) { return envVariable.name === 'CHE_PROJECTS_ROOT' });


            if (!cheApiExternalVar) {
                return;
            }

            var projectsRoot = "/projects";
            if (projectsRootEnvVar && projectsRootEnvVar.value) {
                projectsRoot = projectsRootEnvVar.value;
            }

            const factory = new Resources(FactoryTheiaClient.axiosInstance, String(cheApiExternalVar.value));
            factory.getById<IFactory>(factoryid).then((response: AxiosResponse<IFactory>) => {
                response.data.workspace.projects.forEach((project: IProjectConfig) => {
                    if (!project.source) {
                        return;
                    }

                    const source = project.source;
                    const projectPath = projectsRoot + project.path;

                    this.messageService.info(`Cloning ... ${source.location} to ${projectPath}...`)
                    console.info(`Cloning ... ${source.location} to ${projectPath}...`)
                    setTimeout(() => {
                        console.info(`Cloning after 10 secs... ${source.location} to ${projectPath}...`)
                        this.git.clone(
                            source.location,
                            {
                                localUri: projectPath
                            }
                        ).then(
                            (repo: Repository) => {
                                this.messageService.info(`Project ${projectPath} successfully cloned.`);
                                if (source.parameters['branch']) {
                                    const options: Git.Options.Checkout.Branch = { branch: source.parameters['branch'] };
                                    this.git.checkout(repo, options);
                                }
                            }
                        ).catch((error) => {
                            console.error(`Couldn't clone ${source.location} to ${projectPath}... ${error}`);
                            this.messageService.error(`Couldn't clone ${source.location} to ${projectPath}... ${error}`);
                        });
                    }, 10000);

                });
            });
        })
    }
}