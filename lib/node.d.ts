import type { NodeDataParams, ResultData, DataSource, NodeData } from "./type";
import type { GraphAI } from "./graphai";
import { NodeState } from "./type";
export declare class Node {
    nodeId: string;
    waitlist: Set<string>;
    state: NodeState;
    forkIndex?: number;
    result: ResultData;
    protected graph: GraphAI;
    constructor(nodeId: string, forkIndex: number | undefined, data: NodeData, graph: GraphAI);
    asString(): string;
    removePending(nodeId: string): void;
    protected setResult(result: ResultData, state: NodeState): void;
}
export declare class ComputedNode extends Node {
    params: NodeDataParams;
    retryLimit: number;
    retryCount: number;
    agentId?: string;
    timeout?: number;
    error?: Error;
    fork?: number;
    transactionId: undefined | number;
    sources: Record<string, DataSource>;
    anyInput: boolean;
    inputs: Array<string>;
    pendings: Set<string>;
    readonly isStaticNode = false;
    readonly isComputedNode = true;
    constructor(nodeId: string, forkIndex: number | undefined, data: NodeData, graph: GraphAI);
    pushQueueIfReady(): void;
    private retry;
    removePending(nodeId: string): void;
    execute(): Promise<void>;
}
export declare class StaticNode extends Node {
    value?: ResultData;
    update?: string;
    readonly isStaticNode = true;
    readonly isComputedNode = false;
    constructor(nodeId: string, forkIndex: number | undefined, data: NodeData, graph: GraphAI);
    injectValue(value: ResultData): void;
}
