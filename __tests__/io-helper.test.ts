import * as core from '@actions/core';
import { describe, expect } from '@jest/globals';
import { ActionInputs, getInputs, Inputs } from '../src/io-helper';

let getInputMock: jest.SpiedFunction<typeof core.getInput>;

describe('io-helper.ts', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        getInputMock = jest.spyOn(core, 'getInput').mockImplementation();
    });

    it('should get proper input', () => {
        getInputMock.mockImplementation((name, _) => {
            switch (name) {
                case Inputs.MCUrl:
                    return 'https://example.com';
                case Inputs.UseCache:
                    return 'false';
                default:
                    return '';
            }
        });

        const inputs = getInputs();
        expect(inputs).toEqual({
            url: 'https://example.com',
            useCache: false
        } as ActionInputs);
    });
});

