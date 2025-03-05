# GraphAI Tutorial

## Hello World

GraphAI (https://github.com/receptron/graphai) は、 非プログラマがデータフローを宣言的な言語で記述することでAIアプリケーションを簡単に構築できるようにするオープンソースプロジェクトです。

以下は、GraphAIの "Hello World" です。

```YAML
version: 0.5
nodes:
  llm:
    agent: openAIAgent
    params:
      model: gpt-4o
    inputs:
      prompt: Explain ML's transformer in 100 words.
  output:
    agent: copyAgent
    params:
      namedKey: text
    console:
      after: true
    inputs:
      text: :llm.text
```

この例には、２つのノードがあります：

1. `llm`: このノードは `openAIAgent`というエージェントを使用し、OpenAIの「Chat Completions API」を呼び出します。このエージェントは "Explain ML's transformer in 100 words." というプロンプトを受け取り「Chat Completions API」から返ってきた結果を出力します。
2. `output`: このノードは、`llm` から結果を受け取りコンソールに出力します。

`llm`ノードは、はじめからすべての入力データが揃っているのですぐに実行されますが、`output`ノードは `llm`ノードの結果を受け取ってから実行されます。

## Installation

以下のコマンドで "GraphAI client" をインストールし、自分のマシンで試すことができます：
```
npm i -g  @receptron/graphai_cli
```
プロジェクトフォルダを作成し、ルートディレクトリに環境変数を設定する `.env` ファイルを作成します。以下は、OpenAIのAPIキーを設定する例です。（GeminiやAnthoropic等のAPIを使う場合は別の環境変数を使います）
```
OPENAI_API_KEY=sk-...
```
次のコマンドを使ってyamlファイルを作成します。 (例： "hello.yaml")
```
graphai hello.yaml
```

yamlのサンプルがあるので参考にしてください： [Graphai Samples](https://github.com/receptron/graphai_samples)

## Computed Node and Static Node
GraphAIには、*計算ノード*と*静的ノード*の2種類のノードがあります。

- *計算ノード*：特定の計算を実行するエージェントを定義（宣言）します。前節の例にある両方のノードは*計算ノード*です。
- *静的ノード*：プログラミングの変数のようなもので、値のプレースホルダーです。

（`agent`を持っているノードが計算ノードです）

以下は、前節のyamlファイルの処理と同じ操作を実行します。静的ノードである`prompt`ノードは、"Explain ML's transformer in 100 words" という値を保持しています。

```YAML
version: 0.5
nodes:
  prompt:
    value: Explain ML's transformer in 100 words.
  llm:
    agent: openAIAgent
    params:
      model: gpt-4o
    inputs:
      prompt: :prompt
  output:
    agent: copyAgent
    params:
      namedKey: text
    console:
      after: true
    inputs:
      text: :llm.text
```

## Loop
データフローグラフは設計上非循環である必要がありますが、loop、nest、if/unless、および map（reduceのマッピング）など、いくつかの制御フローを用意しています。

以下は、`loop`を使ったシンプルなアプリケーションです。

```YAML
version: 0.5
loop:
  while: :fruits
nodes:
  fruits:
    value:
      - apple
      - lemomn
      - banana
    update: :shift.array
  result:
    value: []
    update: :reducer.array
    isResult: true
  shift:
    agent: shiftAgent
    inputs:
      array: :fruits
  llm:
    agent: openAIAgent
    params:
      model: gpt-4o
    inputs:
      prompt: What is the typical color of ${:shift.item}? Just answer the color.
  reducer:
    agent: pushAgent
    inputs:
      array: :result
      item: :llm.text
```

1. `fruits`: このノードはプロパティにフルーツのリストを保持しています。これらは、処理が繰り返されるごとに`shift`ノードの配列プロパティで更新されます。
2. `result`: このノードは、はじめに空の配列を保持していますが、処理が繰り返されるごとに`reducer`ノードの値で更新されます。
3. `shift`: このノードは`shiftAgent`を使って`fruits`ノードのリストから最初のアイテムを取り出し、残りのアイテムと配列を出力しています。
4. `llm`: このノードでは、`shift`ノードから受け取った`item`プロパティの値を使ってプロンプトを生成し、`openAIAgent`エージェントを使ってOpenAIのAPIに渡し結果を取得しています。モデルには`gpt-4o`を指定しています。
5. `reducer`: このノードは`pushAgent`を使って`llm`ノードの出力を`result`ノードの配列に追加しています。

各配列の項目は順次処理されます。並行処理をおこなう方法は次の節で解説しています。

## Mapping
以下は、`map`を使ったシンプルなアプリケーションです。

```YAML
version: 0.5
nodes:
  fruits:
    value:
      - apple
      - lemomn
      - banana
  map:
    agent: mapAgent
    inputs:
      rows: :fruits
    isResult: true
    graph:
      nodes:
        llm:
          agent: openAIAgent
          params:
            model: gpt-4o
          inputs:
            prompt: What is the typical color of ${:row}? Just answer the color.
        result:
          agent: copyAgent
          params:
            namedKey: item
          inputs:
            item: :llm.text
          isResult: true
```

1. `fruits`: このノードはプロパティにフルーツの配列を保持しています。
2. `map`: このノードは `mapAgent`を使用しています。`fruits`ノードの配列の各項目に対し並行で処理をおこない、それぞれの結果を結合して出力します。並行処理は、`graph`プロパティで定義されたサブグラフ（ネストで定義された各ノード `prompt`, `llm`, `result`）でおこなわれます。
3. `prompt`: このノードは`stringTemplateAgent`を使用しています。親ノードである`map`ノードから受け取った`row`プロパティをテンプレート文字列 `${0}` に埋め込んでプロンプトを作成します。
4. `llm`: このノードは`openAIAgent`を使用しています。OpenAIのAPIを呼び出し、`prompt`ノードで作成したプロンプトを入力とし、返ってきた結果を出力しています。モデルには`gpt-4o`を指定しています。
5. `result`: このノードは`llm`ノードの出力から`content`プロパティを取得します。

各配列の項目は並行して処理されます。`map`ノードは配列の各要素に対して独立したインスタンスのサブグラフを作成し、それぞれのインスタンスが同時に実行されます。

## ChatBot
以下は、ループを使用したチャットボットアプリケーションです。ユーザーが「/bye」と入力するまで、LLM（大規模言語モデル）と対話を続けることができます。

```YAML
version: 0.5
loop:
  while: :continue
nodes:
  continue:
    value: true
    update: :checkInput
  messages:
    value: []
    update: :llm.messages
    isResult: true
  userInput:
    agent: textInputAgent
    params:
      message: "You:"
      required: true
  checkInput:
    agent: compareAgent
    inputs:
      array:
        - :userInput.text
        - "!="
        - /bye
  llm:
    agent: openAIAgent
    params:
      model: gpt-4o
    inputs:
      messages: :messages
      prompt: :userInput.text
  output:
    agent: stringTemplateAgent
    console:
      after: true
    inputs:
      text: "\e[32mAgent\e[0m: ${:llm.text}"
```

1. The user is prompted to input a message with "You:".
2. `userInput` captures the user's input.
3. `checkInput` evaluates if the input is "/bye". If it is, `continue` is set to `false`, stopping the loop.
4. `userMessage` formats the user's input as a message with the role "user".
5. `appendedMessages` appends the user's message to the existing messages array.
6. `llm` uses the updated messages array to generate a response from the AI model.
7. `output` formats the AI agent's response and prints it to the console.
8. `reducer` appends the AI agent's response to the messages array.
9. The loop continues as long as `continue` is `true`.

## Weather: Function Call and nested graph

Here is an example, which uses the function call capability and nested graph.

```YAML
version: 0.5
loop:
  while: :continue
nodes:
  continue:
    value: true
    update: :checkInput
  messages:
    value:
      - role: system
        content: You are a meteorologist. Use getWeather API, only when the user ask for
          the weather information.
    update: :reducer.array.$0
    isResult: true
  userInput:
    agent: textInputAgent
    params:
      message: "Location:"
  checkInput:
    agent: compareAgent
    inputs:
      array:
        - :userInput.text
        - "!="
        - /bye
  llmCall:
    agent: openAIAgent
    params:
      tools:
        - type: function
          function:
            name: getWeather
            description: get weather information of the specified location
            parameters:
              type: object
              properties:
                latitude:
                  type: number
                  description: The latitude of the location.
                longitude:
                  type: number
                  description: The longitude of the location.
              required:
                - latitude
                - longitude
      model: gpt-4o
    inputs:
      messages: :messages
      prompt: :userInput.text
    if: :checkInput
  output:
    agent: stringTemplateAgent
    inputs:
      text: "Weather: ${:llmCall.text}"
    console:
      after: true
    if: :llmCall.text
  messagesWithFirstRes:
    agent: pushAgent
    inputs:
      array: :messages
      items:
        - :userInput.message
        - :llmCall.message
  tool_calls:
    agent: nestedAgent
    inputs:
      parent_messages: :messagesWithFirstRes.array
      parent_tool: :llmCall.tool
    if: :llmCall.tool
    graph:
      nodes:
        outputFetching:
          agent: stringTemplateAgent
          inputs:
            text: "... fetching weather info: ${:parent_tool.arguments.latitude},
              ${:parent_tool.arguments.longitude}"
          console:
            after: true
        fetchPoints:
          agent: fetchAgent
          inputs:
            url: https://api.weather.gov/points/${:parent_tool.arguments.latitude},${:parent_tool.arguments.longitude}
            headers:
              User-Agent: (receptron.org)
        fetchForecast:
          agent: fetchAgent
          params:
            type: text
          inputs:
            url: :fetchPoints.properties.forecast
            headers:
              User-Agent: (receptron.org)
          unless: :fetchPoints.onError
        extractError:
          agent: stringTemplateAgent
          inputs:
            text: "${:fetchPoints.onError.error.title}:
              ${:fetchPoints.onError.error.detail}"
          if: :fetchPoints.onError
        responseText:
          agent: copyAgent
          anyInput: true
          inputs:
            array:
              - :fetchForecast
              - :extractError
        messagesWithToolRes:
          agent: pushAgent
          inputs:
            array: :parent_messages
            item:
              role: tool
              tool_call_id: :parent_tool.id
              name: :parent_tool.name
              content: :responseText.array.$0
        llmCall:
          agent: openAIAgent
          inputs:
            messages: :messagesWithToolRes.array
          params:
            model: gpt-4o
        output:
          agent: stringTemplateAgent
          inputs:
            text: "Weather: ${:llmCall.text}"
          console:
            after: true
        messagesWithSecondRes:
          agent: pushAgent
          inputs:
            array: :messagesWithToolRes.array
            item: :llmCall.message
          isResult: true
  no_tool_calls:
    agent: copyAgent
    unless: :llmCall.tool
    inputs:
      result: :messagesWithFirstRes.array
  reducer:
    agent: copyAgent
    anyInput: true
    inputs:
      array:
        - :no_tool_calls.result
        - :tool_calls.messagesWithSecondRes.array
```

1. **Loop Execution**: The graph loops continuously until the condition specified by the `continue` node is false.
2. **User Input Prompt**: The system prompts the user to input a location.
3. **User Input Handling**: The input is checked to determine if the conversation should continue.
4. **Message Construction**: User input is processed and added to the conversation messages.
5. **LLM Call**: The system calls an AI model to generate a response based on the conversation messages.
6. **Tool Invocation**: If the AI response includes a tool call (e.g., to fetch weather data), the nested graph handles the tool call and retrieves the necessary information.
7. **Output Generation**: The final response, including the fetched weather information, is formatted and output to the console.

## Dynamic Graph Generation

It is even possible to let the LLM to dynamically generate a GraphAI yaml and run it, which is an equivalent to the code interpreter.

Here is an example (I'm not able to paste the code here, because thd markdown parser will be confused with embedded json tags):

[https://github.com/receptron/graphai_samples/blob/main/samples/openai/metachat.yaml](https://github.com/receptron/graphai_samples/blob/main/samples/openai/metachat.yaml)

This sample application generates a new GraphAI graph based on a sample GraphAI graph ([reception.yaml](https://github.com/receptron/graphai/blob/main/packages/samples/data/reception.json), which retrieves the name, date of birth and gender from the user), and run it. The generated app retrieves the name, address and phone number instead.

## In-memory RAG

This sample application performs an in-memory RAG by dividing a Wikipedi article into chunks, get embedding vectors for those chunks and create an appropriate prompt based on the cosine similarities. 

```YAML
version: 0.5
nodes:
  source:
    value:
      name: Sam Bankman-Fried
      topic: sentence by the court
      query: describe the final sentence by the court for Sam Bank-Fried
  wikipedia:
    console:
      before: ...fetching data from wikkpedia
    agent: wikipediaAgent
    inputs:
      query: :source.name
    params:
      lang: en
  chunks:
    console:
      before: ...splitting the article into chunks
    agent: stringSplitterAgent
    inputs:
      text: :wikipedia.content
  chunkEmbeddings:
    console:
      before: ...fetching embeddings for chunks
    agent: stringEmbeddingsAgent
    inputs:
      array: :chunks.contents
  topicEmbedding:
    console:
      before: ...fetching embedding for the topic
    agent: stringEmbeddingsAgent
    inputs:
      item: :source.topic
  similarities:
    agent: dotProductAgent
    inputs:
      matrix: :chunkEmbeddings
      vector: :topicEmbedding.$0
  sortedChunks:
    agent: sortByValuesAgent
    inputs:
      array: :chunks.contents
      values: :similarities
  referenceText:
    agent: tokenBoundStringsAgent
    inputs:
      chunks: :sortedChunks
    params:
      limit: 5000
  prompt:
    agent: stringTemplateAgent
    inputs:
      prompt: :source.query
      text: :referenceText.content
    params:
      template: |-
        Using the following document, ${text}

        ${prompt}
  RagQuery:
    console:
      before: ...performing the RAG query
    agent: openAIAgent
    inputs:
      prompt: :prompt
    params:
      model: gpt-4o
  OneShotQuery:
    agent: openAIAgent
    inputs:
      prompt: :source.query
    params:
      model: gpt-4o
  RagResult:
    agent: copyAgent
    inputs:
      result: :RagQuery.text
    isResult: true
  OneShotResult:
    agent: copyAgent
    inputs:
      result: :OneShotQuery.text
    isResult: true
```