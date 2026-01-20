import React, { useCallback, useMemo } from 'react';
import type { StorageContext } from './storage-context';
import { storageContext } from './storage-context';
import Dexie, { type EntityTable } from 'dexie';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { determineCardinalities } from '@/lib/domain/db-relationship';
import type { ChartDBConfig } from '@/lib/domain/config';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
import type { Note } from '@/lib/domain/note';
import { BACKEND_SERVER_URL } from '@/lib/env';
import { toast } from '@/components/toast/use-toast';
import { debounce } from '@/lib/utils';

type requestProps = {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    payload?: object;
    params?: object;
};

const API_SERVER_URL = window?.env?.BACKEND_SERVER_URL ?? BACKEND_SERVER_URL;
const USE_REMOTE_DB = API_SERVER_URL !== undefined && API_SERVER_URL.length > 0;

let BACKEND_API_TOKEN = sessionStorage.getItem('backend_api_token') ?? '';
if (USE_REMOTE_DB) {
    if (BACKEND_API_TOKEN === '') {
        BACKEND_API_TOKEN = window?.prompt('Enter a value:') ?? '';
    }
    sessionStorage.setItem('backend_api_token', BACKEND_API_TOKEN);
}

const requestToServer = async (props: requestProps): Promise<object> => {
    const apiUrl = API_SERVER_URL + '/chartdb' + props.path;
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Mytoken-type ${BACKEND_API_TOKEN}`,
    };
    if (props.method === 'GET' || props.method === 'DELETE') {
        const apiUrlWithParams = props.params
            ? apiUrl.concat(
                  '?',
                  new URLSearchParams(
                      props.params as Record<string, string>
                  ).toString()
              )
            : apiUrl;
        const response = await fetch(apiUrlWithParams, {
            method: props.method,
            headers,
        })
            .then((res) => {
                if (res) {
                    return { res, error: undefined };
                }
                return { res: JSON.parse('{ "ok": true }'), error: undefined };
            })
            .catch(() => {
                return {
                    res: JSON.parse(
                        '{"ok": false,"status": "CONN_REFUSED","statusText": "Network Error"}'
                    ),
                    error: 'Network Error',
                };
            });

        if (response.error !== undefined) {
            toast({
                title: `Sync DB Failed (${response.res.status})`,
                description: `Can't connect to server: ${response.res.statusText}`,
                variant: 'destructive',
            });
        } else if (!response.res.ok) {
            toast({
                title: `Sync DB Failed (${response.res.status})`,
                description: `Failed to fetch ${apiUrl}: ${response.res.statusText}`,
                variant: 'destructive',
            });
        }
        if (response.res && props.method === 'GET') {
            return await response.res.json();
        }
        return {};
    } else {
        // POST or PUT
        const response = await fetch(apiUrl, {
            method: props.method,
            headers,
            body: JSON.stringify(props.payload),
        })
            .then((res) => {
                if (res) {
                    return { res, error: undefined };
                }
                return { res: JSON.parse('{ "ok": true }'), error: undefined };
            })
            .catch(() => {
                return {
                    res: JSON.parse(
                        '{"ok": false,"status": 500,"statusText": "Network Error"}'
                    ),
                    error: 'Network Error',
                };
            });
        if (response.error !== undefined) {
            toast({
                title: `Sync DB Failed`,
                description: `Can't connect to server: ${response.error}`,
                variant: 'destructive',
            });
        } else if (!response.res.ok) {
            toast({
                title: `Sync DB Failed (${response.res.status})`,
                description: `Failed to fetch ${apiUrl}: ${response.res.statusText}`,
                variant: 'destructive',
            });
        }
        return await response.res;
    }
};

export const StorageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const db = useMemo(() => {
        const dexieDB = new Dexie('ChartDB') as Dexie & {
            diagrams: EntityTable<
                Diagram,
                'id' // primary key "id" (for the typings only)
            >;
            db_tables: EntityTable<
                DBTable & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            db_relationships: EntityTable<
                DBRelationship & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            db_dependencies: EntityTable<
                DBDependency & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            areas: EntityTable<
                Area & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            db_custom_types: EntityTable<
                DBCustomType & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            notes: EntityTable<
                Note & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            config: EntityTable<
                ChartDBConfig & { id: number },
                'id' // primary key "id" (for the typings only)
            >;
            diagram_filters: EntityTable<
                DiagramFilter & { diagramId: string },
                'diagramId' // primary key "id" (for the typings only)
            >;
        };

        // Schema declaration:
        dexieDB.version(1).stores({
            diagrams: '++id, name, databaseType, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, x, y, fields, indexes, color, createdAt, width',
            db_relationships:
                '++id, diagramId, name, sourceTableId, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(2).upgrade((tx) =>
            tx
                .table<DBTable & { diagramId: string }>('db_tables')
                .toCollection()
                .modify((table) => {
                    for (const field of table.fields) {
                        field.type = {
                            // @ts-expect-error string before
                            id: (field.type as string).split(' ').join('_'),
                            // @ts-expect-error string before
                            name: field.type,
                        };
                    }
                })
        );

        dexieDB.version(3).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, x, y, fields, indexes, color, createdAt, width',
            db_relationships:
                '++id, diagramId, name, sourceTableId, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(4).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, x, y, fields, indexes, color, createdAt, width, comment',
            db_relationships:
                '++id, diagramId, name, sourceTableId, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(5).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(6).upgrade((tx) =>
            tx
                .table<DBRelationship & { diagramId: string }>(
                    'db_relationships'
                )
                .toCollection()
                .modify((relationship, ref) => {
                    const { sourceCardinality, targetCardinality } =
                        determineCardinalities(
                            // @ts-expect-error string before
                            relationship.type ?? 'one_to_one'
                        );

                    relationship.sourceCardinality = sourceCardinality;
                    relationship.targetCardinality = targetCardinality;

                    // @ts-expect-error string before
                    delete ref.value.type;
                })
        );

        dexieDB.version(7).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(8).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(9).upgrade((tx) =>
            tx
                .table<DBTable & { diagramId: string }>('db_tables')
                .toCollection()
                .modify((table) => {
                    for (const field of table.fields) {
                        if (typeof field.nullable === 'string') {
                            field.nullable =
                                (field.nullable as string).toLowerCase() ===
                                'true';
                        }
                    }
                })
        );

        dexieDB.version(10).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(11).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            db_custom_types:
                '++id, diagramId, schema, type, kind, values, fields',
            config: '++id, defaultDiagramId',
        });

        dexieDB
            .version(12)
            .stores({
                diagrams:
                    '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
                db_tables:
                    '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
                db_relationships:
                    '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
                db_dependencies:
                    '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
                areas: '++id, diagramId, name, x, y, width, height, color',
                db_custom_types:
                    '++id, diagramId, schema, type, kind, values, fields',
                config: '++id, defaultDiagramId',
                diagram_filters: 'diagramId, tableIds, schemasIds',
            })
            .upgrade((tx) => {
                tx.table('config').clear();
            });

        dexieDB.version(13).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            db_custom_types:
                '++id, diagramId, schema, type, kind, values, fields',
            config: '++id, defaultDiagramId',
            diagram_filters: 'diagramId, tableIds, schemasIds',
            notes: '++id, diagramId, content, x, y, width, height, color',
        });

        dexieDB.on('ready', async () => {
            if (!USE_REMOTE_DB) {
                const config = await dexieDB.config.get(1);

                if (!config) {
                    const diagrams = await dexieDB.diagrams.toArray();

                    await dexieDB.config.add({
                        id: 1,
                        defaultDiagramId: diagrams?.[0]?.id ?? '',
                    });
                }
            }
        });
        return dexieDB;
    }, []);

    const getConfig: StorageContext['getConfig'] =
        useCallback(async (): Promise<ChartDBConfig | undefined> => {
            if (USE_REMOTE_DB) {
                return (await requestToServer({
                    path: '/config/1',
                    method: 'GET',
                })) as ChartDBConfig;
            }
            return await db.config.get(1);
        }, [db]);

    const updateConfig: StorageContext['updateConfig'] = useCallback(
        async (config) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: '/config/1',
                    method: 'PUT',
                    payload: config,
                });
                return;
            }
            await db.config.update(1, config);
        },
        [db]
    );

    const getDiagramFilter: StorageContext['getDiagramFilter'] = useCallback(
        async (diagramId: string): Promise<DiagramFilter | undefined> => {
            if (USE_REMOTE_DB) {
                return await requestToServer({
                    path: `/diagram-filters/${diagramId}`,
                    method: 'GET',
                });
            }
            return await db.diagram_filters.get({ diagramId });
        },
        [db]
    );

    const updateDiagramFilter: StorageContext['updateDiagramFilter'] =
        useCallback(
            async (diagramId, filter): Promise<void> => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/diagram-filters/${diagramId}`,
                        method: 'PUT',
                        payload: { ...filter },
                    });
                    return;
                }
                await db.diagram_filters.put({
                    diagramId,
                    ...filter,
                });
            },
            [db]
        );

    const deleteDiagramFilter: StorageContext['deleteDiagramFilter'] =
        useCallback(
            async (diagramId: string): Promise<void> => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/diagram-filters/${diagramId}`,
                        method: 'DELETE',
                    });
                    return;
                }
                await db.diagram_filters.where({ diagramId }).delete();
            },
            [db]
        );

    const addTable: StorageContext['addTable'] = useCallback(
        async ({ diagramId, table }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/db-tables/${diagramId}`,
                    method: 'POST',
                    payload: table,
                });
                return;
            }
            await db.db_tables.add({
                ...table,
                diagramId,
            });
        },
        [db]
    );

    const getTable: StorageContext['getTable'] = useCallback(
        async ({ id, diagramId }): Promise<DBTable | undefined> => {
            // Not using remote DB
            return await db.db_tables.get({ id, diagramId });
        },
        [db]
    );

    const deleteDiagramTables: StorageContext['deleteDiagramTables'] =
        useCallback(
            async (diagramId) => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/db-tables/${diagramId}`,
                        method: 'DELETE',
                    });
                    return;
                }
                await db.db_tables
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
            },
            [db]
        );

    const updateTable: StorageContext['updateTable'] = useCallback(
        async ({ id, diagramId, attributes }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/db-tables/${diagramId}/${id}`,
                    method: 'PUT',
                    payload: attributes,
                });
                return;
            }
            await db.db_tables.update(id, attributes);
        },
        [db]
    );

    const updateTableDebounce = debounce(updateTable, 1000);

    const putTable: StorageContext['putTable'] = useCallback(
        async ({ diagramId, table }) => {
            // Not using remote DB
            await db.db_tables.put({ ...table, diagramId });
        },
        [db]
    );

    const putTables: StorageContext['putTables'] = useCallback(
        async ({ diagramId, tables }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/db-tables/${diagramId}`,
                    method: 'PUT',
                    payload: tables,
                });
                return;
            }
        },
        []
    );

    const putTablesDebounce = debounce(putTables, 1000);

    const deleteTable: StorageContext['deleteTable'] = useCallback(
        async ({ id, diagramId }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/db-tables/${diagramId}/${id}`,
                    method: 'DELETE',
                });
                return;
            }
            await db.db_tables.where({ id, diagramId }).delete();
        },
        [db]
    );

    const listTables: StorageContext['listTables'] = useCallback(
        async (diagramId): Promise<DBTable[]> => {
            // Fetch all tables associated with the diagram
            if (USE_REMOTE_DB) {
                return (await requestToServer({
                    path: `/db-tables/${diagramId}`,
                    method: 'GET',
                })) as DBTable[];
            }
            const tables = await db.db_tables
                .where('diagramId')
                .equals(diagramId)
                .toArray();

            return tables;
        },
        [db]
    );

    const addRelationship: StorageContext['addRelationship'] = useCallback(
        async ({ diagramId, relationship }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/db-relationships/${diagramId}`,
                    method: 'POST',
                    payload: relationship,
                });
                return;
            }
            await db.db_relationships.add({
                ...relationship,
                diagramId,
            });
        },
        [db]
    );

    const deleteDiagramRelationships: StorageContext['deleteDiagramRelationships'] =
        useCallback(
            async (diagramId) => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/db-relationships/${diagramId}`,
                        method: 'DELETE',
                    });
                    return;
                }
                await db.db_relationships
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
            },
            [db]
        );

    const getRelationship: StorageContext['getRelationship'] = useCallback(
        async ({ id, diagramId }): Promise<DBRelationship | undefined> => {
            // Not using remote DB
            return await db.db_relationships.get({ id, diagramId });
        },
        [db]
    );

    const updateRelationship: StorageContext['updateRelationship'] =
        useCallback(
            async ({ id, diagramId, attributes }) => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/db-relationships/${diagramId}/${id}`,
                        method: 'PUT',
                        payload: attributes,
                    });
                    return;
                }
                await db.db_relationships.update(id, attributes);
            },
            [db]
        );

    const deleteRelationship: StorageContext['deleteRelationship'] =
        useCallback(
            async ({ id, diagramId }) => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/db-relationships/${diagramId}/${id}`,
                        method: 'DELETE',
                    });
                    return;
                }
                await db.db_relationships.where({ id, diagramId }).delete();
            },
            [db]
        );

    const listRelationships: StorageContext['listRelationships'] = useCallback(
        async (diagramId): Promise<DBRelationship[]> => {
            // Sort relationships alphabetically
            if (USE_REMOTE_DB) {
                const relationships = (await requestToServer({
                    path: `/db-relationships/${diagramId}`,
                    method: 'GET',
                })) as DBRelationship[];
                return relationships.sort((a, b) =>
                    a.name.localeCompare(b.name)
                );
            }
            return (
                await db.db_relationships
                    .where('diagramId')
                    .equals(diagramId)
                    .toArray()
            ).sort((a, b) => {
                return a.name.localeCompare(b.name);
            });
        },
        [db]
    );

    const addDependency: StorageContext['addDependency'] = useCallback(
        async ({ diagramId, dependency }) => {
            await db.db_dependencies.add({
                ...dependency,
                diagramId,
            });
        },
        [db]
    );

    const getDependency: StorageContext['getDependency'] = useCallback(
        async ({ diagramId, id }) => {
            return await db.db_dependencies.get({ id, diagramId });
        },
        [db]
    );

    const updateDependency: StorageContext['updateDependency'] = useCallback(
        async ({ id, attributes }) => {
            await db.db_dependencies.update(id, attributes);
        },
        [db]
    );

    const deleteDependency: StorageContext['deleteDependency'] = useCallback(
        async ({ diagramId, id }) => {
            await db.db_dependencies.where({ id, diagramId }).delete();
        },
        [db]
    );

    const listDependencies: StorageContext['listDependencies'] = useCallback(
        async (diagramId) => {
            return await db.db_dependencies
                .where('diagramId')
                .equals(diagramId)
                .toArray();
        },
        [db]
    );

    const deleteDiagramDependencies: StorageContext['deleteDiagramDependencies'] =
        useCallback(
            async (diagramId) => {
                await db.db_dependencies
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
            },
            [db]
        );

    const addArea: StorageContext['addArea'] = useCallback(
        async ({ area, diagramId }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/areas/${diagramId}`,
                    method: 'POST',
                    payload: area,
                });
                return;
            }
            await db.areas.add({
                ...area,
                diagramId,
            });
        },
        [db]
    );

    const getArea: StorageContext['getArea'] = useCallback(
        async ({ diagramId, id }) => {
            // Not using remote DB
            return await db.areas.get({ id, diagramId });
        },
        [db]
    );

    const updateArea: StorageContext['updateArea'] = useCallback(
        async ({ id, diagramId, attributes }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/areas/${diagramId}/${id}`,
                    method: 'PUT',
                    payload: attributes,
                });
                return;
            }
            await db.areas.update(id, attributes);
        },
        [db]
    );

    const updateAreaDebounce = debounce(updateArea, 1000);

    const deleteArea: StorageContext['deleteArea'] = useCallback(
        async ({ diagramId, id }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/areas/${diagramId}/${id}`,
                    method: 'DELETE',
                });
                return;
            }
            await db.areas.where({ id, diagramId }).delete();
        },
        [db]
    );

    const listAreas: StorageContext['listAreas'] = useCallback(
        async (diagramId) => {
            if (USE_REMOTE_DB) {
                return (await requestToServer({
                    path: `/areas/${diagramId}`,
                    method: 'GET',
                })) as Area[];
            }
            return await db.areas
                .where('diagramId')
                .equals(diagramId)
                .toArray();
        },
        [db]
    );

    const deleteDiagramAreas: StorageContext['deleteDiagramAreas'] =
        useCallback(
            async (diagramId) => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/areas/${diagramId}`,
                        method: 'DELETE',
                    });
                    return;
                }
                await db.areas.where('diagramId').equals(diagramId).delete();
            },
            [db]
        );

    // Custom type operations
    const addCustomType: StorageContext['addCustomType'] = useCallback(
        async ({ diagramId, customType }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/db-custom-types/${diagramId}`,
                    method: 'POST',
                    payload: customType,
                });
                return;
            }
            await db.db_custom_types.add({
                ...customType,
                diagramId,
            });
        },
        [db]
    );

    const getCustomType: StorageContext['getCustomType'] = useCallback(
        async ({ diagramId, id }): Promise<DBCustomType | undefined> => {
            // Not using remote DB
            return await db.db_custom_types.get({ id, diagramId });
        },
        [db]
    );

    const updateCustomType: StorageContext['updateCustomType'] = useCallback(
        async ({ id, diagramId, attributes }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/db-custom-types/${diagramId}/${id}`,
                    method: 'PUT',
                    payload: attributes,
                });
                return;
            }
            await db.db_custom_types.update(id, attributes);
        },
        [db]
    );

    const deleteCustomType: StorageContext['deleteCustomType'] = useCallback(
        async ({ diagramId, id }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/db-custom-types/${diagramId}/${id}`,
                    method: 'DELETE',
                });
                return;
            }
            await db.db_custom_types.where({ id, diagramId }).delete();
        },
        [db]
    );

    const listCustomTypes: StorageContext['listCustomTypes'] = useCallback(
        async (diagramId): Promise<DBCustomType[]> => {
            if (USE_REMOTE_DB) {
                return (await requestToServer({
                    path: `/db-custom-types/${diagramId}`,
                    method: 'GET',
                })) as DBCustomType[];
            }
            return (
                await db.db_custom_types
                    .where('diagramId')
                    .equals(diagramId)
                    .toArray()
            ).sort((a, b) => {
                return a.name.localeCompare(b.name);
            });
        },
        [db]
    );

    const deleteDiagramCustomTypes: StorageContext['deleteDiagramCustomTypes'] =
        useCallback(
            async (diagramId) => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/db-custom-types/${diagramId}`,
                        method: 'DELETE',
                    });
                    return;
                }
                await db.db_custom_types
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
            },
            [db]
        );

    // Note operations
    const addNote: StorageContext['addNote'] = useCallback(
        async ({ note, diagramId }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/notes/${diagramId}`,
                    method: 'POST',
                    payload: note,
                });
                return;
            }
            await db.notes.add({
                ...note,
                diagramId,
            });
        },
        [db]
    );

    const getNote: StorageContext['getNote'] = useCallback(
        async ({ diagramId, id }) => {
            // Not using remote DB
            return await db.notes.get({ id, diagramId });
        },
        [db]
    );

    const updateNote: StorageContext['updateNote'] = useCallback(
        async ({ id, diagramId, attributes }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/notes/${diagramId}/${id}`,
                    method: 'PUT',
                    payload: attributes,
                });
                return;
            }
            await db.notes.update(id, attributes);
        },
        [db]
    );

    const updateNoteDebounce = debounce(updateNote, 1000);

    const deleteNote: StorageContext['deleteNote'] = useCallback(
        async ({ diagramId, id }) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/notes/${diagramId}/${id}`,
                    method: 'DELETE',
                });
                return;
            }
            await db.notes.where({ id, diagramId }).delete();
        },
        [db]
    );

    const listNotes: StorageContext['listNotes'] = useCallback(
        async (diagramId) => {
            if (USE_REMOTE_DB) {
                return (await requestToServer({
                    path: `/notes/${diagramId}`,
                    method: 'GET',
                })) as Note[];
            }
            return await db.notes
                .where('diagramId')
                .equals(diagramId)
                .toArray();
        },
        [db]
    );

    const deleteDiagramNotes: StorageContext['deleteDiagramNotes'] =
        useCallback(
            async (diagramId) => {
                if (USE_REMOTE_DB) {
                    await requestToServer({
                        path: `/notes/${diagramId}`,
                        method: 'DELETE',
                    });
                    return;
                }
                await db.notes.where('diagramId').equals(diagramId).delete();
            },
            [db]
        );

    const addDiagram: StorageContext['addDiagram'] = useCallback(
        async ({ diagram }) => {
            const promises = [];
            if (USE_REMOTE_DB) {
                const tzOffset = new Date().getTimezoneOffset() * 60000;
                let createdAt: string | undefined;
                let updatedAt: string | undefined;
                if (typeof diagram.createdAt === 'object') {
                    createdAt = new Date(
                        diagram.createdAt.getTime() - tzOffset
                    ).toISOString();
                } else {
                    createdAt = diagram.createdAt;
                }
                if (typeof diagram.updatedAt === 'object') {
                    updatedAt = new Date(
                        diagram.updatedAt.getTime() - tzOffset
                    ).toISOString();
                } else {
                    updatedAt = diagram.updatedAt;
                }
                await requestToServer({
                    path: `/diagrams`,
                    method: 'POST',
                    payload: {
                        id: diagram.id,
                        name: diagram.name,
                        databaseType: diagram.databaseType,
                        databaseEdition: diagram.databaseEdition,
                        createdAt,
                        updatedAt,
                    },
                });
            } else {
                promises.push(
                    db.diagrams.add({
                        id: diagram.id,
                        name: diagram.name,
                        databaseType: diagram.databaseType,
                        databaseEdition: diagram.databaseEdition,
                        createdAt: diagram.createdAt,
                        updatedAt: diagram.updatedAt,
                    })
                );
            }

            const tables = diagram.tables ?? [];
            promises.push(
                ...tables.map((table) =>
                    addTable({ diagramId: diagram.id, table })
                )
            );

            const relationships = diagram.relationships ?? [];
            promises.push(
                ...relationships.map((relationship) =>
                    addRelationship({ diagramId: diagram.id, relationship })
                )
            );

            const dependencies = diagram.dependencies ?? [];
            promises.push(
                ...dependencies.map((dependency) =>
                    addDependency({ diagramId: diagram.id, dependency })
                )
            );

            const areas = diagram.areas ?? [];
            promises.push(
                ...areas.map((area) => addArea({ diagramId: diagram.id, area }))
            );

            const customTypes = diagram.customTypes ?? [];
            promises.push(
                ...customTypes.map((customType) =>
                    addCustomType({ diagramId: diagram.id, customType })
                )
            );

            const notes = diagram.notes ?? [];
            promises.push(
                ...notes.map((note) => addNote({ diagramId: diagram.id, note }))
            );

            await Promise.all(promises);
        },
        [
            db,
            addArea,
            addCustomType,
            addDependency,
            addRelationship,
            addTable,
            addNote,
        ]
    );

    const listDiagrams: StorageContext['listDiagrams'] = useCallback(
        async (
            options = {
                includeRelationships: false,
                includeTables: false,
                includeDependencies: false,
                includeAreas: false,
                includeCustomTypes: false,
                includeNotes: false,
            }
        ): Promise<Diagram[]> => {
            let diagrams: Diagram[];
            if (USE_REMOTE_DB) {
                diagrams = (await requestToServer({
                    path: `/diagrams`,
                    method: 'GET',
                })) as Diagram[];
            } else {
                diagrams = await db.diagrams.toArray();
            }

            diagrams = diagrams.map((diagram) => ({
                ...diagram,
                createdAt: new Date(Date.parse(diagram.createdAt.toString())),
                updatedAt: new Date(Date.parse(diagram.updatedAt.toString())),
            }));

            if (options.includeTables) {
                diagrams = await Promise.all(
                    diagrams.map(async (diagram) => {
                        diagram.tables = await listTables(diagram.id);
                        return diagram;
                    })
                );
            }

            if (options.includeRelationships) {
                diagrams = await Promise.all(
                    diagrams.map(async (diagram) => {
                        diagram.relationships = await listRelationships(
                            diagram.id
                        );
                        return diagram;
                    })
                );
            }

            if (options.includeDependencies) {
                diagrams = await Promise.all(
                    diagrams.map(async (diagram) => {
                        diagram.dependencies = await listDependencies(
                            diagram.id
                        );
                        return diagram;
                    })
                );
            }

            if (options.includeAreas) {
                diagrams = await Promise.all(
                    diagrams.map(async (diagram) => {
                        diagram.areas = await listAreas(diagram.id);
                        return diagram;
                    })
                );
            }

            if (options.includeCustomTypes) {
                diagrams = await Promise.all(
                    diagrams.map(async (diagram) => {
                        diagram.customTypes = await listCustomTypes(diagram.id);
                        return diagram;
                    })
                );
            }

            if (options.includeNotes) {
                diagrams = await Promise.all(
                    diagrams.map(async (diagram) => {
                        diagram.notes = await listNotes(diagram.id);
                        return diagram;
                    })
                );
            }

            return diagrams;
        },
        [
            db,
            listAreas,
            listCustomTypes,
            listDependencies,
            listRelationships,
            listTables,
            listNotes,
        ]
    );

    const getDiagram: StorageContext['getDiagram'] = useCallback(
        async (
            id,
            options = {
                includeRelationships: false,
                includeTables: false,
                includeDependencies: false,
                includeAreas: false,
                includeCustomTypes: false,
                includeNotes: false,
            }
        ): Promise<Diagram | undefined> => {
            let diagram: Diagram | undefined;
            if (USE_REMOTE_DB) {
                diagram = (await requestToServer({
                    path: `/diagrams/${id}`,
                    method: 'GET',
                })) as Diagram;
            } else {
                diagram = await db.diagrams.get(id);
            }

            if (!diagram || diagram.updatedAt == undefined) {
                return undefined;
            }

            if (options.includeTables) {
                diagram.tables = await listTables(id);
            }

            if (options.includeRelationships) {
                diagram.relationships = await listRelationships(id);
            }

            if (options.includeDependencies) {
                diagram.dependencies = await listDependencies(id);
            }

            if (options.includeAreas) {
                diagram.areas = await listAreas(id);
            }

            if (options.includeCustomTypes) {
                diagram.customTypes = await listCustomTypes(id);
            }

            if (options.includeNotes) {
                diagram.notes = await listNotes(id);
            }

            return diagram;
        },
        [
            db,
            listAreas,
            listCustomTypes,
            listDependencies,
            listRelationships,
            listTables,
            listNotes,
        ]
    );

    const updateDiagram: StorageContext['updateDiagram'] = useCallback(
        async ({ id, attributes }) => {
            if (USE_REMOTE_DB) {
                const tzOffset = new Date().getTimezoneOffset() * 60000;
                let updatedAt: string | undefined;
                if (attributes.updatedAt) {
                    updatedAt = new Date(
                        attributes.updatedAt.getTime() - tzOffset
                    ).toISOString();
                }
                await requestToServer({
                    path: `/diagrams/${id}`,
                    method: 'PUT',
                    payload: {
                        ...attributes,
                        updatedAt,
                    },
                });
            } else {
                await db.diagrams.update(id, attributes);
            }

            if (attributes.id) {
                await Promise.all([
                    db.db_tables
                        .where('diagramId')
                        .equals(id)
                        .modify({ diagramId: attributes.id }),
                    db.db_relationships
                        .where('diagramId')
                        .equals(id)
                        .modify({ diagramId: attributes.id }),
                    db.db_dependencies
                        .where('diagramId')
                        .equals(id)
                        .modify({ diagramId: attributes.id }),
                    db.areas.where('diagramId').equals(id).modify({
                        diagramId: attributes.id,
                    }),
                    db.db_custom_types
                        .where('diagramId')
                        .equals(id)
                        .modify({ diagramId: attributes.id }),
                    db.notes.where('diagramId').equals(id).modify({
                        diagramId: attributes.id,
                    }),
                ]);
            }
        },
        [db]
    );

    const updateDiagramDebounce = debounce(updateDiagram, 1000);

    const deleteDiagram: StorageContext['deleteDiagram'] = useCallback(
        async (id) => {
            if (USE_REMOTE_DB) {
                await requestToServer({
                    path: `/diagrams/${id}`,
                    method: 'DELETE',
                });
            } else {
                await Promise.all([
                    db.diagrams.delete(id),
                    db.db_tables.where('diagramId').equals(id).delete(),
                    db.db_relationships.where('diagramId').equals(id).delete(),
                    db.db_dependencies.where('diagramId').equals(id).delete(),
                    db.areas.where('diagramId').equals(id).delete(),
                    db.db_custom_types.where('diagramId').equals(id).delete(),
                    db.notes.where('diagramId').equals(id).delete(),
                ]);
            }
        },
        [db]
    );

    return (
        <storageContext.Provider
            value={{
                getConfig,
                updateConfig,
                addDiagram,
                listDiagrams,
                getDiagram,
                updateDiagram: updateDiagramDebounce,
                deleteDiagram,
                addTable,
                getTable,
                updateTable: updateTableDebounce,
                putTable,
                putTables: putTablesDebounce,
                deleteTable,
                listTables,
                addRelationship,
                getRelationship,
                updateRelationship,
                deleteRelationship,
                listRelationships,
                deleteDiagramTables,
                deleteDiagramRelationships,
                addDependency,
                getDependency,
                updateDependency,
                deleteDependency,
                listDependencies,
                deleteDiagramDependencies,
                addArea,
                getArea,
                updateArea: updateAreaDebounce,
                deleteArea,
                listAreas,
                deleteDiagramAreas,
                addCustomType,
                getCustomType,
                updateCustomType,
                deleteCustomType,
                listCustomTypes,
                deleteDiagramCustomTypes,
                addNote,
                getNote,
                updateNote: updateNoteDebounce,
                deleteNote,
                listNotes,
                deleteDiagramNotes,
                getDiagramFilter,
                updateDiagramFilter,
                deleteDiagramFilter,
            }}
        >
            {children}
        </storageContext.Provider>
    );
};
