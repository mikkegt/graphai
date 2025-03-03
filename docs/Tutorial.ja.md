# GraphAI Tutorial

## Hello World

GraphAI (https://github.com/receptron/graphai) は、 非プログラマがデータフローを宣言的な言語で記述することでAIアプリケーションを簡単に構築できるようにするオープンソースプロジェクトです。

以下は、GraphAIの "Hello World" です。

```YAML
version: 0.3
nodes:
  llm:
    agent: openAIAgent
    params:
      model: gpt-4o
    inputs:
      prompt: Explain ML's transformer in 100 words.
  output:
    agent: copyAgent
    console:
      after: true
    inputs:
      - :llm.choices.$0.message.content
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
version: 0.3
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
    console:
      after: true
    inputs:
      - :llm.choices.$0.message.content
```

## Loop
データフローグラフは設計上非循環である必要がありますが、loop、nest、if/unless、および map（reduceのマッピング）など、いくつかの制御フローを用意しています。

以下は、`loop`を使ったシンプルなアプリケーションです。

```YAML
version: 0.3
loop:
  while: :fruits
nodes:
  fruits:
    value: [apple, lemon, banana]
    update: :shift.array
  result:
    value: []
    update: :reducer
    isResult: true
  shift:
    agent: shiftAgent
    inputs: 
      array: [:fruits]
  prompt:
    agent: stringTemplateAgent
    params:
      template: What is the typical color of ${0}? Just answer the color.
    inputs: [:shift.item]
  llm:
    agent: openAIAgent
    params:
      model: gpt-4o
    inputs: 
      prompt: [:prompt]
  reducer:
    agent: pushAgent
    inputs:
      array: :result
      item: :llm.choices.$0.message.content
```

1. `fruits`: このノードはプロパティにフルーツの配列を保持しています。この配列の内容は、処理が繰り返されるごとに`shift`ノードで更新されます。
2. `result`: このノードは空の配列を保持していますが、処理が繰り返されるごとに`reducer`ノードの値で更新されます。
3. `shift`: このノードは`shiftAgent`を使用しています。`fruits`ノードの配列から最初の項目を取り出し、残りの配列を保持します。
4. `prompt`: このノードは`stringTemplateAgent`を使用しています。、`shift`ノードから受け取った`item`プロパティをテンプレート文字列 `${0}` に埋め込んでプロンプトを作成します。
5. `llm`: このノードは`openAIAgent`を使用しています。OpenAIのAPIを呼び出し、`prompt`ノードで作成したプロンプトを入力とし、返ってきた結果を出力しています。モデルには`gpt-4o`を指定しています。
6. `reducer`: このノードは`pushAgent`を使用しています。`llm`ノードの出力を`result`ノードの配列に追加します。

各配列の項目は順次処理されます。並行処理をおこなう方法は次の節で解説しています。

## Mapping
以下は、`map`を使ったシンプルなアプリケーションです。

```YAML
version: 0.3
nodes:
  fruits:
    value: [apple, lemon, banana]
  map:
    agent: mapAgent
    inputs:
      rows: :fruits
    isResult: true
    graph:
      nodes:
        prompt:
          agent: stringTemplateAgent
          params:
            template: What is the typical color of ${0}? Just answer the color.
          inputs: [:row]
        llm:
          agent: openAIAgent
          params:
            model: gpt-4o
          inputs: 
            prompt: [:prompt]
        result:
          agent: copyAgent
          inputs: [:llm.choices.$0.message.content]
          isResult: true
```

1. `fruits`: このノードはプロパティにフルーツの配列を保持しています。
2. `map`: このノードは `mapAgent`を使用しています。`fruits`ノードの配列の各項目に対し並行で処理をおこない、それぞれの結果を結合して出力します。並行処理は、`graph`プロパティで定義されたサブグラフ（ネストで定義された各ノード `prompt`, `llm`, `result`）でおこなわれます。
3. `prompt`: このノードは`stringTemplateAgent`を使用しています。親ノードである`map`ノードから受け取った`row`プロパティをテンプレート文字列 `${0}` に埋め込んでプロンプトを作成します。
4. `llm`: このノードは`openAIAgent`を使用しています。OpenAIのAPIを呼び出し、`prompt`ノードで作成したプロンプトを入力とし、返ってきた結果を出力しています。モデルには`gpt-4o`を指定しています。
5. `result`: このノードは`llm`ノードの出力から`content`プロパティを取得します。

各配列の項目は並行して処理されます。`map`ノードは配列の各要素に対して独立したインスタンスのサブグラフを作成し、それぞれのインスタンスが同時に実行されます。

## ChatBot

Here is a chatbot application using the loop, which allows the user to talk to the LLM until she/he types "/bye".

```YAML
version: 0.3
loop:
  while: :continue
nodes:
  continue:
    value: true
    update: :checkInput.continue
  messages:
    value: []
    update: :reducer
  userInput:
    agent: textInputAgent
    params:
      message: "You:"
  checkInput:
    agent: propertyFilterAgent
    params:
      inspect:
        - propId: continue
          notEqual: /bye
    inputs:
      - {}
      - :userInput
  userMessage:
    agent: propertyFilterAgent
    params:
      inject:
        - propId: content
          from: 1
    inputs:
      - role: user
      - :userInput
  appendedMessages:
    agent: pushAgent
    inputs:
      array: :messages
      item: :userMessage
  llm:
    agent: openAIAgent
    inputs:
      messages: :appendedMessages
  output:
    agent: stringTemplateAgent
    params:
      template: "\e[32mLLM\e[0m: ${0}"
    console:
      after: true
    inputs:
      - :llm.choices.$0.message.content
  reducer:
    agent: pushAgent
    inputs:
      array: :appendedMessages
      item: :llm.choices.$0.message
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
version: 0.3
loop:
  while: :continue
nodes:
  continue:
    value: true
    update: :checkInput.continue
  messages:
    value:
      - role: system
        content: You are a meteorologist. Use getWeather API, only when the user ask for
          the weather information.
    update: :reducer
    isResult: true
  userInput:
    agent: textInputAgent
    params:
      message: "Location:"
  checkInput:
    agent: propertyFilterAgent
    params:
      inspect:
        - propId: continue
          notEqual: /bye
    inputs:
      - {}
      - :userInput
  userMessage:
    agent: propertyFilterAgent
    params:
      inject:
        - propId: content
          from: 1
    inputs:
      - role: user
      - :userInput
  messagesWithUserInput:
    agent: pushAgent
    inputs:
      array: :messages
      item: :userMessage
    if: :checkInput.continue
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
    inputs:
      messages: :messagesWithUserInput
  output:
    agent: stringTemplateAgent
    params:
      template: "Weather: ${0}"
    console:
      after: true
    inputs:
      - :llmCall.choices.$0.message.content
    if: :llmCall.choices.$0.message.content
  messagesWithFirstRes:
    agent: pushAgent
    inputs:
      array: :messagesWithUserInput
      item: :llmCall.choices.$0.message
  tool_calls:
    agent: nestedAgent
    inputs:
      tool_calls: :llmCall.choices.$0.message.tool_calls
      messagesWithFirstRes: :messagesWithFirstRes
    if: :llmCall.choices.$0.message.tool_calls
    graph:
      nodes:
        outputFetching:
          agent: stringTemplateAgent
          params:
            template: "... fetching weather info: ${0}"
          console:
            after: true
          inputs:
            - :tool_calls.$0.function.arguments
        parser:
          agent: jsonParserAgent
          inputs:
            - :tool_calls.$0.function.arguments
        urlPoints:
          agent: stringTemplateAgent
          params:
            template: https://api.weather.gov/points/${0},${1}
          inputs:
            - :parser.latitude
            - :parser.longitude
        fetchPoints:
          agent: fetchAgent
          inputs:
            url: :urlPoints
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
          params:
            template: "${0}: ${1}"
          inputs:
            - :fetchPoints.onError.error.title
            - :fetchPoints.onError.error.detail
          if: :fetchPoints.onError
        responseText:
          agent: copyAgent
          anyInput: true
          inputs:
            - :fetchForecast
            - :extractError
        toolMessage:
          agent: propertyFilterAgent
          params:
            inject:
              - propId: tool_call_id
                from: 1
              - propId: name
                from: 2
              - propId: content
                from: 3
          inputs:
            - role: tool
            - :tool_calls.$0.id
            - :tool_calls.$0.function.name
            - :responseText
        messagesWithToolRes:
          agent: pushAgent
          inputs:
            array: :messagesWithFirstRes
            item: :toolMessage
        llmCall:
          agent: openAIAgent
          inputs:
            messages: :messagesWithToolRes
        output:
          agent: stringTemplateAgent
          params:
            template: "Weather: ${0}"
          console:
            after: true
          inputs:
            - :llmCall.choices.$0.message.content
        messagesWithSecondRes:
          agent: pushAgent
          inputs:
            array: :messagesWithToolRes
            item: :llmCall.choices.$0.message
          isResult: true
  no_tool_calls:
    agent: copyAgent
    unless: :llmCall.choices.$0.message.tool_calls
    inputs:
      - :messagesWithFirstRes
  reducer:
    agent: copyAgent
    anyInput: true
    inputs:
      - :no_tool_calls
      - :tool_calls.messagesWithSecondRes
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
version: 0.3
nodes:
  source:
    value:
      name: Sam Bankman-Fried
      topic: sentence by the court
      query: describe the final sentence by the court for Sam Bankman-Fried
  wikipedia:
    console:
      before: ...fetching data from wikipedia
    agent: wikipediaAgent
    inputs:
      - :source.name
    params:
      lang: en
  chunks:
    console:
      before: ...splitting the article into chunks
    agent: stringSplitterAgent
    inputs:
      text: :wikipedia.content
  embeddings:
    console:
      before: ...fetching embeddings for chunks
    agent: stringEmbeddingsAgent
    inputs:
      - :chunks.contents
  topicEmbedding:
    console:
      before: ...fetching embedding for the topic
    agent: stringEmbeddingsAgent
    inputs:
      - :source.topic
  similarityCheck:
    agent: dotProductAgent
    inputs:
      matrix: :embeddings
      vector: :topicEmbedding.$0
  sortedChunks:
    agent: sortByValuesAgent
    inputs:
      array: :chunks.contents
      values: :similarityCheck
  referenceText:
    agent: tokenBoundStringsAgent
    inputs:
      chunks: :sortedChunks
    params:
      limit: 5000
  prompt:
    agent: stringTemplateAgent
    inputs:
      - :source.query
      - :referenceText.content
    params:
      template: |-
        Using the following document, ${0}

        ${1}
  RagQuery:
    console:
      before: ...performing the RAG query
    agent: openAIAgent
    inputs:
      prompt: :prompt
  OneShotQuery:
    agent: openAIAgent
    inputs:
      prompt: :source.query
  RagResult:
    agent: copyAgent
    inputs:
      - :RagQuery.choices.$0.message.content
    isResult: true
  OneShotResult:
    agent: copyAgent
    inputs:
      - :OneShotQuery.choices.$0.message.content
    isResult: true
```