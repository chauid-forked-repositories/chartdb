import type { DataTypeData } from './data-types';

export const mariadbDataTypes: readonly DataTypeData[] = [
    // Level 1 - Most commonly used types
    {
        name: 'int',
        id: 'int',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 255 },
        usageLevel: 1,
    },
    {
        name: 'bigint',
        id: 'bigint',
        usageLevel: 1,
        fieldAttributes: { hasCharMaxLength: true, maxLength: 255 },
    },
    {
        name: 'decimal',
        id: 'decimal',
        usageLevel: 1,
        fieldAttributes: {
            precision: {
                max: 65,
                min: 1,
                default: 10,
            },
            scale: {
                max: 38,
                min: 0,
                default: 0,
            },
        },
    },
    { name: 'boolean', id: 'boolean', usageLevel: 1 },
    {
        name: 'datetime',
        id: 'datetime',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 6 },
        usageLevel: 1,
    },
    { name: 'date', id: 'date', usageLevel: 1 },
    {
        name: 'timestamp',
        id: 'timestamp',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 6 },
        usageLevel: 1,
    },
    {
        name: 'varchar',
        id: 'varchar',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 191 },
        usageLevel: 1,
    },
    {
        name: 'text',
        id: 'text',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 4294967295 },
        usageLevel: 1,
    },

    // Level 2 - Second most common types
    { name: 'json', id: 'json', usageLevel: 2 },
    { name: 'uuid', id: 'uuid', usageLevel: 2 },

    // Less common types
    {
        name: 'tinyint',
        id: 'tinyint',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 255 },
    },
    {
        name: 'smallint',
        id: 'smallint',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 255 },
    },
    {
        name: 'mediumint',
        id: 'mediumint',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 255 },
    },
    {
        name: 'numeric',
        id: 'numeric',
        fieldAttributes: {
            precision: {
                max: 65,
                min: 1,
                default: 10,
            },
            scale: {
                max: 38,
                min: 0,
                default: 0,
            },
        },
    },
    {
        name: 'float',
        id: 'float',
        fieldAttributes: {
            precision: {
                max: 255,
                min: 1,
                default: 10,
            },
            scale: {
                max: 30,
                min: 0,
                default: 0,
            },
        },
    },
    {
        name: 'double',
        id: 'double',
        fieldAttributes: {
            precision: {
                max: 255,
                min: 1,
                default: 10,
            },
            scale: {
                max: 30,
                min: 0,
                default: 0,
            },
        },
    },
    {
        name: 'bit',
        id: 'bit',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 64 },
    },
    { name: 'bool', id: 'bool' },
    {
        name: 'time',
        id: 'time',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 6 },
    },
    { name: 'year', id: 'year' },
    {
        name: 'char',
        id: 'char',
        fieldAttributes: { hasCharMaxLength: true, maxLength: 191 },
    },
    { name: 'binary', id: 'binary' },
    { name: 'varbinary', id: 'varbinary' },
    { name: 'tinyblob', id: 'tinyblob' },
    { name: 'blob', id: 'blob' },
    { name: 'mediumblob', id: 'mediumblob' },
    { name: 'longblob', id: 'longblob' },
    { name: 'tinytext', id: 'tinytext' },
    { name: 'mediumtext', id: 'mediumtext' },
    { name: 'longtext', id: 'longtext' },
    { name: 'enum', id: 'enum', fieldAttributes: { allowedValues: true } },
    { name: 'set', id: 'set', fieldAttributes: { allowedValues: true } },
    { name: 'geometry', id: 'geometry' },
    { name: 'point', id: 'point' },
    { name: 'linestring', id: 'linestring' },
    { name: 'polygon', id: 'polygon' },
    { name: 'multipoint', id: 'multipoint' },
    { name: 'multilinestring', id: 'multilinestring' },
    { name: 'multipolygon', id: 'multipolygon' },
    { name: 'geometrycollection', id: 'geometrycollection' },
] as const;
