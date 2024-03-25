import path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

import * as core from '@actions/core';
import * as cache from '@actions/tool-cache';
import { ActionInputs, getInputs } from './io-helper';

// 'arm', 'arm64', 'ia32', 'loong64','mips', 'mipsel', 'ppc', 'ppc64', 'riscv64', 's390', 's390x', and 'x64'
export const archMap = {
    x64: 'amd64',
    arm: 'arm',
    arm64: 'arm64',
    s390x: 's390x',
    mips: 'mips64',
    ppc64: 'ppc64le'
} as { [key: string]: string };

// 'aix', 'darwin', 'freebsd','linux','openbsd', 'sunos', and 'win32'.
export const platformMap = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows'
} as { [key: string]: string };


// https://dl.min.io/client/mc/release/
export const combinations = [
    'darwin-amd64',
    'darwin-arm64',
    'linux-amd64',
    'linux-arm',
    'linux-arm64',
    'linux-mips64',
    'linux-ppc64le',
    'linux-s390x',
    'windows-amd64'
];

export async function run() {
    try {
        const inputs: ActionInputs = getInputs();

        const platform = os.platform();
        let arch = os.arch();

        let version = 'latest';

        const useCache = inputs.useCache;

        if (!Object.keys(archMap).includes(arch)) {
            const availableValues = Object.keys(archMap).map(s => `'${s}'`).join(', ');
            core.setFailed(`Unsupported arch, please run on: ${availableValues}`);
            return;
        }

        if (!Object.keys(platformMap).includes(platform)) {
            const availableValues = Object.keys(platformMap).map(s => `'${s}'`).join(', ');
            core.setFailed(`Unsupported platform, please run on: ${availableValues}`);
            return;
        }

        const combination = `${platformMap[platform]}-${archMap[arch]}`;
        if (!combinations.includes(combination)) {
            const availableValues = combinations.map(s => `'${s}'`).join(', ');
            core.setFailed(`Unsupported combination of platform/arch, please run on: ${availableValues}`);
            return;
        }

        let toolPath;

        if (useCache) {
            toolPath = cache.find('mc', version, arch);
        }

        if (!toolPath) {
            let url = inputs.url
                .replace('{platform}', platformMap[platform])
                .replace('{arch}', archMap[arch]);

            if (url.includes('windows')) {
                url += '.exe';
            }

            core.info(`Obtaining ${url}`);

            const downloadPath = await cache.downloadTool(url);
            if (useCache) {
                toolPath = await cache.cacheFile(downloadPath, 'mc', 'mc', version, arch);
                fs.chmodSync(path.join(toolPath as string, 'mc'), 0o755);
            } else {
                const newPath = path.join(path.dirname(downloadPath), 'mc');
                fs.renameSync(downloadPath, newPath);

                fs.chmodSync(newPath, 0o755);
                core.info(`fs.chmodSync(${newPath})`);
                toolPath = path.dirname(newPath);
            }
        }

        core.info(`core.addPath(${toolPath})`);
        core.addPath(toolPath);
        core.info('Success!');
    } catch (err: any) {
        core.setFailed(err.message);
    }
}
