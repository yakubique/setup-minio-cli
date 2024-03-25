import * as os from 'node:os';
import * as fs from 'node:fs';

import * as core from '@actions/core';
import * as cache from '@actions/tool-cache';

import * as helper from '../src/io-helper';
import { archMap, combinations, platformMap, run } from '../src/run';

import { describe, expect } from '@jest/globals';

jest.mock('node:os', () => {
    return {
        __esModule: true,    //    <----- this __esModule: true is important
        ...jest.requireActual('node:os')
    };
});

jest.mock('node:fs', () => {
    return {
        __esModule: true,
        ...jest.requireActual('node:fs')
    };
});

let getInputsMock: jest.SpiedFunction<typeof helper.getInputs>;
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>;

let platformMock: jest.SpiedFunction<typeof os.platform>;
let archMock: jest.SpiedFunction<typeof os.arch>;

let findMock: jest.SpiedFunction<typeof cache.find>;
let downloadToolMock: jest.SpiedFunction<typeof cache.downloadTool>;
let cacheFileMock: jest.SpiedFunction<typeof cache.cacheFile>;

let chmodSyncMock: jest.SpiedFunction<typeof fs.chmodSync>;
let renameSyncMock: jest.SpiedFunction<typeof fs.renameSync>;


describe('run.ts', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        getInputsMock = jest.spyOn(helper, 'getInputs').mockImplementation();
        platformMock = jest.spyOn(os, 'platform').mockImplementation();
        archMock = jest.spyOn(os, 'arch').mockImplementation();
        setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation();
        findMock = jest.spyOn(cache, 'find').mockImplementation();
        downloadToolMock = jest.spyOn(cache, 'downloadTool').mockImplementation();
        cacheFileMock = jest.spyOn(cache, 'cacheFile').mockImplementation();
        chmodSyncMock = jest.spyOn(fs, 'chmodSync').mockImplementation();
        renameSyncMock = jest.spyOn(fs, 'renameSync').mockImplementation();
    });

    it('should download and cache', async () => {
        const url = 'https://dl.min.io/client/mc/release/{platform}-{arch}/mc';
        const arch = 'x64';
        const platform = 'win32';
        const pathToFile = 'path/to/file';
        const urlRendered = `https://dl.min.io/client/mc/release/${platformMap[platform]}-${archMap[arch]}/mc.exe`;

        getInputsMock.mockImplementation(() => {
            return {
                url,
                useCache: true
            } as helper.ActionInputs;
        });

        archMock.mockImplementation(() => arch);
        platformMock.mockImplementation(() => platform);

        findMock.mockImplementation(() => '');
        downloadToolMock.mockImplementation(() => new Promise((resolve) => resolve(pathToFile)));
        cacheFileMock.mockImplementation(() => new Promise((resolve) => resolve(`${pathToFile}/mc`)));

        await run();
        expect(getInputsMock).toBeCalled(); // get inputs
        expect(findMock).toBeCalledWith('mc', 'latest', arch); // look into cache storage
        expect(downloadToolMock).toHaveBeenCalledWith(urlRendered); // download new binary
        expect(cacheFileMock).toHaveBeenCalledWith(pathToFile, 'mc', 'mc', 'latest', arch); // cache downloaded file
        expect(chmodSyncMock).toHaveBeenCalledWith(`${pathToFile}/mc/mc`, 0o755); // cache downloaded file
    });

    it('should download and DONT cache', async () => {
        const url = 'https://dl.min.io/client/mc/release/{platform}-{arch}/mc';
        const arch = 'arm';
        const platform = 'linux';
        const pathToFile = 'path/to/file';
        const urlRendered = `https://dl.min.io/client/mc/release/${platformMap[platform]}-${archMap[arch]}/mc`;

        getInputsMock.mockImplementation(() => {
            return {
                url,
                useCache: false
            } as helper.ActionInputs;
        });

        archMock.mockImplementation(() => arch);
        platformMock.mockImplementation(() => platform);

        downloadToolMock.mockImplementation(() => new Promise((resolve) => resolve(pathToFile)));
        cacheFileMock.mockImplementation(() => new Promise((resolve) => resolve(`${pathToFile}/mc`)));

        await run();
        expect(getInputsMock).toBeCalled(); // get inputs
        expect(findMock).not.toBeCalled(); // DON'T look into cache storage
        expect(downloadToolMock).toHaveBeenCalledWith(urlRendered); // download new binary
        expect(cacheFileMock).not.toHaveBeenCalled(); // DON'T cache downloaded file
        expect(renameSyncMock).toHaveBeenCalledWith(pathToFile, pathToFile.replace('file', 'mc'));
        expect(chmodSyncMock).toHaveBeenCalledWith(pathToFile.replace('file', 'mc'), 0o755); // cache downloaded file
    });

    ['ia32', 'loong64', 'mipsel', 'ppc', 'riscv64', 's390'].forEach((unsupportedArch) => {
        it(`unsupported arch '${unsupportedArch}'`, async () => {
            getInputsMock.mockImplementation(() => ({} as helper.ActionInputs));
            setFailedMock.mockImplementation();

            archMock.mockImplementation(() => unsupportedArch);

            await run();
            const availableValues = Object.keys(archMap).map(s => `'${s}'`).join(', ');
            expect(getInputsMock).toBeCalled();
            expect(setFailedMock).toBeCalledWith(`Unsupported arch, please run on: ${availableValues}`);
        });
    });

    ['aix', 'freebsd', 'openbsd', 'sunos'].forEach((unsupportedPlatform) => {
        it(`unsupported platform '${unsupportedPlatform}'`, async () => {
            getInputsMock.mockImplementation(() => ({} as helper.ActionInputs));
            setFailedMock.mockImplementation();

            archMock.mockImplementation(() => 'arm');
            platformMock.mockImplementation(() => unsupportedPlatform as any);

            await run();
            const availableValues = Object.keys(platformMap).map(s => `'${s}'`).join(', ');
            expect(getInputsMock).toBeCalled();
            expect(setFailedMock).toBeCalledWith(`Unsupported platform, please run on: ${availableValues}`);
        });
    });

    it('unsupported combination', async () => {
        getInputsMock.mockImplementation(() => ({} as helper.ActionInputs));
        setFailedMock.mockImplementation();

        archMock.mockImplementation(() => 'arm');
        platformMock.mockImplementation(() => 'win32');

        await run();
        const availableValues = combinations.map(s => `'${s}'`).join(', ');
        expect(getInputsMock).toBeCalled();
        expect(setFailedMock).toBeCalledWith(`Unsupported combination of platform/arch, please run on: ${availableValues}`);
    });

    it('any error', async () => {
        getInputsMock.mockImplementation(() => {
            throw new Error('unexpected input');
        });
        setFailedMock.mockImplementation();

        await run();
        expect(getInputsMock).toBeCalled();
        expect(setFailedMock).toBeCalledWith('unexpected input');
    });

});

