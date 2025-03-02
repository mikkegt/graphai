# GraphAI

## Overview
GraphAIは、プログラムがどのように動くかを図のように見せてくれるエンジンです。開発者は、プログラムの流れをYAMLやJSONという形式で書くだけで、複雑な非同期処理（同時に複数の作業を行う処理）を簡単に管理できるようになります。

例えば、大規模言語モデル（LLM）を使って何かを作るとき、何度もAPIを呼び出して少しずつ良い結果を得るという方法があります。この方法を「エージェントワークフロー」と呼びます。こういったアプリケーションは、データベースのクエリやウェブ検索など、たくさんの非同期な処理を必要とします。

しかし、プログラムが複雑になると、これらの非同期な処理の依存関係を管理するのは難しくなります。GraphAIを使えば、これらの依存関係をYAMLやJSONで簡単に書き表せるので、開発者は複雑な部分を気にせずに済みます。

## Declarative Data Flow Programming
### 宣言的データワークフロープログラミング

以下は簡単な例です。データソースとしてWikipediaを使用し、In-MemoryのRAG（Retrieval-Augmented Generation、検索強化生成）を実行します。「In-MemoryのRAG」とは、データをメモリ上に保持しながら、検索と生成を組み合わせて高品質な結果を生成する手法です。

```YAML
nodes:
  source: // 入力データ
    value:
      name: Sam Bankman-Fried
      query: describe the final sentence by the court for Sam Bank-Fried
  wikipedia: // Wikipediaからデータを取得
    agent: wikipediaAgent
    inputs: [:source.name]
  chunks: // Wikipediaからのテキストをチャンクに分割（各2048文字、512文字重複）
    agent: stringSplitterAgent
    inputs: [:wikipedia]
  chunkEmbeddings: // 各チャンクの埋め込みベクトルを取得
    agent: stringEmbeddingsAgent
    inputs: [:chunks]
  topicEmbedding: // 質問の埋め込みベクトルを取得
    agent: stringEmbeddingsAgent
    inputs: [:source.query]
  similarities: // 各チャンクのコサイン類似度を計算
    agent: dotProductAgent
    inputs: [:chunkEmbeddings, :topicEmbedding]
  sortedChunks: // 類似度に基づいてチャンクをソート
    agent: sortByValuesAgent
    inputs: [:chunks, :similarities]
  referenceText: // トークン制限（5000）までチャンクを連結
    agent: tokenBoundStringsAgent
    inputs: [:sortedChunks]
    params:
      limit: 5000
  prompt: // 参照テキストを使ってプロンプトを生成
    agent: stringTemplateAgent
    inputs: [:source, :referenceText]
    params:
      template: |-
        Using the following document, ${0}
        ${1}
  query: // GPT-3.5から答えを取得
    agent: slashGPTAgent
    params:
      manifest:
        model: gpt-3.5-turbo
    isResult: true // 最終結果であることを示す
    inputs: [:prompt]
```

```mermaid
flowchart TD
 source -- name --> wikipedia(wikipedia)
 source -- query --> topicEmbedding(topicEmbedding)
 wikipedia --> chunks(chunks)
 chunks --> chunkEmbeddings(chunkEmbeddings)
 chunkEmbeddings --> similarities(similarities)
 topicEmbedding --> similarities
 similarities --> sortedChunks(sortedChunks)
 sortedChunks --> referenceText(resourceText)
 source -- query --> prompt(prompt)
 referenceText --> prompt
 prompt --> query(query)
```

クエリテキストを埋め込みベクトルに変換する処理と、テキストチャンクを埋め込みベクトルの配列に変換する処理は、それぞれ独立しているため同時に実行できます。GraphAIはこれを自動的に認識し、並行して実行します。このような並行プログラミングは従来のプログラミングスタイルでは非常に難しいのですが、GraphAIのデータフローフロープログラミングを使えば容易に実装できます。

Note: クエリテキストを埋め込みベクトルに変換する処理
1. テキストの入力: テキスト（質問や文章など）を入力します。
2. 埋め込みモデルの使用: 埋め込みモデルと呼ばれる機械学習モデルを使用して、テキストを数値の配列に変換します。このモデルは、テキストの意味や文脈を数学的に表現するために訓練されています。
3. ベクトルの生成: 埋め込みモデルがテキストを処理し、各単語やフレーズに対応する数値の配列（ベクトル）を生成します。このベクトルは、テキストの意味を保持しつつ、コンピュータが計算や比較を行いやすくするためのものです。

## Quick Install

```
npm install graphai
```

or

```
yarn add graphai
```

## Data Flow Graph
データフローグラフ（DFG）は、データの流れを定義するJavaScriptオブジェクトです。通常、YAMLファイルで記述され、実行時に読み込まれます。

DFGは、データフロー内の個々のノードを表す一連のネストされたプロパティを含む [node(ノード)](#node)のコレクションで構成されています。各ノードは、一意のキーnodeId（例：node1, node2）で識別され、ノードの動作や他のノードとの関係を決定するいくつかの事前定義されたプロパティ（params, inputs, valueなど）を含むことができます。ノードには、以下で説明する [computed nodes（計算ノード）](#computed-node) と [static nodes（静的ノード）](#static-node), の2種類があります。

### Data Source
ノード同士のつながりは、「inputs」、「update」、「if」または「while」プロパティを使って、あるノードから別のノードに参照を渡すことで作られます。これらのプロパティの値はデータソースと呼ばれます。

ノードの定義：
- 「:」+ nodeId（例：`:node1`）

データソースの書き方：
- 「:」+ nodeId + propertyId（例：`:node1.item`）
- インデックス（例：`:node1.$0`、`:node2.$last`）
- 組み合わせ（例：`:node1.messages.$0.content`）


### DFG Structure
データフローグラフの構造

- *version*: GraphAIのバージョン（必須）
- *nodes*: ノードのリスト（必須）
- *concurrency*: 同時に実行するエージェント関数の最大数を指定するプロパティ（デフォルトは8）
- *loop*: グラフを反復実行させるプロパティ（詳細は [ループセクション](#loop) を参照）

## Agent
エージェントは、いくつかの入力を受け取り、非同期に出力を生成する仕組み（または機能）です。エージェントは、LLM呼び出し（例えばGPT-4）やメディア生成、データベースアクセス、HTTP経由のREST APIなどがあります。エージェントプロパティで指定されたエージェントに関連付けられたノードは[computed nodes（計算ノード）](#computed-node)と呼ばれます。computed nodesはデータソースから一連の入力を受け取り、エージェント関数にその処理を依頼し、返された値を他のノードが利用できるようにします。

### Agent function
エージェント関数とは、特定のエージェントを実装し、関連付けられた計算ノードのために計算を行うTypeScript関数のことです。エージェント関数はcontext（AgentFunctionContext型）を受け取り、以下のプロパティを持ちます：

An *agent function* is a TypeScript function, which implements a particular *agent*, performing some computations for the associated *computed node*. An *agent function* receives a *context* (type AgentFunctionContext), which has following properties:

- *params*: agent specific parameters specified in the DFG (specified by the "params" property of the node)
- *inputs*: a set of inputs came from other nodes (specified by "inputs" property of the node).
- *debugInfo*: a set of information for debugging purposes.

There are additional optional parameters for developers of nested agents and agent filters.

- *graphData*: an optional GraphData (for nested agents)
- *agents*: AgentFunctionInfoDictionary (for nested agents)
- *taskManager*: TaskManager (for nested agents)
- *log*: TransactionLog[] (for nested agents)
- *filterParams*: agent filter parameters (for agent filters)

### Inline Agent Function

An *inline agent function* is a simplified version of *agent function*, which is embedded in the graph (available only when the graph was described in TypeScript). An *inline agent function* receives only the *inputs* paramter as a variable length arguments.

Here is an examnple (from [weather chat](https://github.com/receptron/graphai/blob/main/samples/sample_weather.ts)):

```typescript
    messagesWithUserInput: {
      // Appends the user's input to the messages.
      agent: (messages: Array<any>, content: string) => [...messages, { role: "user", content }],
      inputs: [":messages", ":userInput"],
      if: "checkInput",
    },
```

## Node

There are two types of Node, *computed nodes* and *static nodes*. 

A *computed node* is associated with an *agent function*, which receives some inputs, performs some computations asynchronously, and returns the result (output). 

A *static node* is a placeholder of a value (just like a variable in programming languages), which is initially specified by its *value* property, and can be updated by an external program (before the execution of the graph), or updated using the *update* property at the end of each iteration of a [loop](#loop) operation. 

### Computed Node

A *computed node* has following properties.

- *agent*: An **required** property, which specifies the id of the *agent function*, or an *inline agent function* (NOTE: this is not possible in JSON or YAML).
- *params*: An optional agent-specific property to control the behavior of the associated agent function. The top level property may reference a *data source*.
- *inputs*: An optional list of *data sources* that the current node receives the data from. This establishes a data flow where the current node can only be executed after the completion of the nodes listed under *inputs*. If this list is empty, the associated *agent function* will be immediatley executed. 
- *anyInput*: An optiona boolean flag, which indicates that the associated *agent function* will be called when at least one of input data became available. Otherwise, it will wait until all the data became available.
- *retry*: An optional number, which specifies the maximum number of retries to be made. If the last attempt fails, the error will be recorded.
- *timeout*: An optional number, which specifies the maximum waittime in msec. If the associated agent function does not return the value in time, the "Timeout" error will be recorded. The returned value received after the time out will be discarded.
- *isResult*: An optional boolean value, which indicates that the return value of this node, should be included as a property of the return value from the run() method of the GraphUI instance.
- *priority*: An optional number, which specifies the priority of the execution of the associated agent (the task). Default is 0, which means "neutral". Negative numbers are allowed as well.
- *if*: An optional data source property. The node will be activated only if the value from the data source is truthy. 
- *unless*: An optional data source property. The node will be activated only if the value from the data source is falty (including empty array). 
- *graph*: An optional property for nested agents, which specifies the inner graph. This value can be a graph itself or the data souce, whose value is a graph.

### Static Node

A *static* node has following properties.

- *value*: An **required** property, which specifies the initial value of this static node (equivalent to calling the injectValue method from outside).
- *update*: An optional property, which specifies the *data source* for a [loop](#loop) operation. After each iteration, the value of this node will be updated with the data from the specified *data source*.

## Flow Control

Since the data-flow graph must be asyclic by design, we added a few mechanisms to control data flows, [nesting](#nesting), [loop](#loop), [mapping](#mapping) and [conditional flow](#conditional-flow).

### Nested Graph

In order to make it easy to reuse some code, GraphAI supports nesting. It requires a special agent function, which creates an instance (or instances) of GraphAI object within the agent function and execute it. The system supports two types of nesting agent functions (nestAgent and mapAgent), but developers can create their own using the standard agent extension mechanism.

A typical nesting graph looks like this:

```YAML
nodes:
  question:
    value: "Find out which materials we need to purchase this week for Joe Smith's residential house project."
  projectId: // identifies the projectId from the question
    agent: "identifierAgent"
    inputs: [":source"] // == "sourceNode.query"
  database:
    agent: "nestedAgent"
    inputs:
      prompt: ":question"
      projectId: ":projectId"
    graph:
      nodes:
        schema: // retrieves the database schema for the apecified projectId
          agent: "schemaAgent"
          inputs: [":projectId"]
        ... // issue query to the database and build an appropriate prompt with it.
        query: // send the generated prompt to the LLM
          agent: "llama3Agent"
          inputs: [":prompt"]
          isResult: true
  response: // Deliver the answer
    agent: "deliveryAgent"      
    inputs: [:database.query.$last.content]
```

The databaseQuery node (which is associated "nestedAgent") takes the data from "question" node abd "projectId" node, and make them available to inner nodes (nodes of the child graph) via phantom node, "$0" and "$1". After the completion of the child graph, the data from "query" node (which has "isResult" property) becomes available as a property of the output of "database" node.

Here is the diagram of the parent graph.

```mermaid
flowchart LR
 question --> projectId(projectId)
 question --> database
 projectId --> database
 database[[database]] -- query --> response(response)
```

Here is the diagram of the child graph. Notice that two phantom nodes are automatically created to allow inner nodes to access input data from the parent graph.

```mermaid
flowchart LR
 $0 --> ...
 $1 --> schema(schema)
 schema --> ...(...)
 ... --> query(query)
```

This mechanism does not only allows devleoper to reuse code, but also makes it possible to execute the child graph on another machine using a "remote" agent (which will be released later), enabling the *distributed execution* of nested graphs. 

### Loop

The loop is an optional property of a graph, which has two optional properties. 

- *count*: Specifies the number of times the graph needs to be executed.
- *while*: Specifies the *data source* to check after the each iteration. It continues if the data from that *data source* is *true*. Unlike JavaScript, an empty array will be treated as *false*.

Here is an example, which performs an LLM query for each person in the list and create the list of answers. The "people" node (static), is initialized with an array of names, and the "retriever" node (computed) retrieves one name at a time, and sends it to the "query" node (computed) to perform an LLM query. The "reducer" append it the array retrieved form the "result" node (static node, which is initialized as an empty array). 

The "update" property of two static nodes ("people" and "result"), updates those properties based on the results from the previous itelation. This loop continues until the value of "people" node become an empty array.

```
loop:
  while: :people
nodes:
  people:
    value: [Steve Jobs, Elon Musk, Nikola Tesla]
    update: :retriever.array
  result:
    value: []
    update: :reducer
    isResult: true
  retriever:
    agent: shift
    inputs: [people]
  query:
    agent: slashgpt
    params:
      manifest:
        prompt: Describe about the person in less than 100 words
    inputs: [:retriever.item]
  reducer:
    agent: push
    inputs: [:result, :query.content]
```

```mermaid
flowchart LR
 result --> reducer(reducer)
 people --> retriever(retriever)
 retriever -- item --> query(query)
 query -- content --> reducer
 retriever -. array .-> people
 reducer -.-> result
```

The *loop* mechanism is often used with a nested graph, which receives an array of data from a node of the parent graph and performs the "reduction" process of a *map-reduce* operation, just like the *reduce* method of JavaScript.

Please notice that each iteration will be done sequencially unlike the *mapping* described below.

### Mapping

The mapAgent is one of nested agents, which receives an array of data as an input (inputs[0]) and performs the same operation (specified by its graph property) on each item concurrently.

If the size of array is N, the mapAgent creates N instances of GraphAI object, and run them concurrently.

After the completion of all of instances, the mapAgent returns an array of results, just like the map function of JavaScript. 

The following graph will generate the same result (an array of answers) as the sample graph for the *loop*, but three queries will be issued concurretly. 

```
nodes:
  people:
    value: [Steve Jobs, Elon Musk, Nikola Tesla]
  retriever:
    agent: "mapAgent"
    inputs: { rows: ":people" }
    graph:
      nodes:
        query:
          agent: slashgpt
          params:
            manifest:
              prompt: Describe about the person in less than 100 words
          inputs: [":row"]
```

Here is the conceptual representation of this operation.

```mermaid
flowchart LR
 people -- "[0]" --> query_0(query_0)
 people -- "[1]" --> query_1(query_1)
 people -- "[2]" --> query_2(query_2)
 query_0 --> retriever[[retriever]]
 query_1 --> retriever
 query_2 --> retriever
```
### Conditional Flow

GraphAI provides mechanisms to control the flow of data based on certain conditions. This is achieved through the *if* and *anyInput* properties.

#### If/Unless Property

The *if* property allows you to specify a condition that must be met for the data to flow into a particular node. The condition is defined by a data source. If the value obtained from the specified *data source* is truthy (i.e., not null, undefined, 0, false, NaN, or an empty array/string), the node will be executed; otherwise, it will be skipped.The *unless* property is just the opporsite of the *if* property. 

For example, the following node will be executed only if the *tool_calls* property of the message from the LLM contains a non-zero/non-empty value:

```typescript
    tool_calls: {
      // This node is activated if the LLM requests a tool call.
      agent: "nestedAgent",
      inputs: [":groq.choices.$0.message.tool_calls", ":messagesWithFirstRes"],
      if: ":groq.choices.$0.message.tool_calls",
      graph: {
        // This graph is nested only for the readability.
```

It is recommended to use the *if* property in conjunction with nested graphs for better code readability and organization.

#### AnyInput Property

The *anyInput* property (boolean) allows you to merge multiple data flow paths into a single node. When set to *true*, the agent function associated with the node will be executed as soon as data becomes available from any of the specified input data sources.

This property is particularly useful when you want to continue the flow regardless of which path the data comes from. In the weather chat sample application, it is used to continue the chat iteration whether a tool was requested by the LLM or not:

```typescript
    reducer: {
      // Receives messages from either case.
      agent: "copyAgent",
      anyInput: true,
      inputs: [":no_tool_calls", ":tool_calls.messagesWithSecondRes"],
    },
```

In this example, the "reducer" node will execute as soon as data is available from either the "no_tool_calls" or "tool_calls.messagesWithSecondRes" data source.

By combining the *if* and *anyInput* properties, you can create complex conditional flows that control the execution of nodes based on the availability and values of data from various sources. This flexibility allows you to build sophisticated data-driven applications with GraphAI.

## Concurrency

GraphAI supports concurrent execution of tasks, allowing you to leverage parallelism and improve performance. The level of concurrency can be controlled through the *concurrency* property at the top level of the graph definition.

```typescript
  concurrency: 16 # Maximum number of concurrent tasks
```

If the *concurrency* property is not specified, the default value of 8 is used.

### Concurrency and Nested Graphs

Since the task queue is shared between the parent graph and the children graph (uness the graph is running remotely), tasks created by the child graph will be bound by the same concurrency specified by the parent graph. 

Since the task executing the nested graph will be in "running" state while tasks within the child graph are runnig, the concurrency limit will be incremented by one when we start running the child graph and restored when it is completed.

### Task Prioritization

By default, tasks are executed in a first-in, first-out (FIFO) order with a neutral priority (0). However, you can assign custom priorities to nodes using the *priority* property. Tasks associated with nodes that have a higher priority value will be executed before those with lower priorities.

Negative priority values are allowed, enabling you to fine-tune the execution order based on your application's requirements.