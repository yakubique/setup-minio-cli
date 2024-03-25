import * as core from '@actions/core';
import { getBooleanInput } from '@yakubique/atils/dist';

export enum Inputs {
    MCUrl = 'mc_url',
    UseCache = 'use_cache'
}

export interface ActionInputs {
    url: string;
    useCache: boolean;
}

export function getInputs(): ActionInputs {
    const result = {} as ActionInputs;

    result.url = core.getInput(Inputs.MCUrl, { required: true });
    result.useCache = getBooleanInput(Inputs.UseCache, { required: false });

    return result;
}
