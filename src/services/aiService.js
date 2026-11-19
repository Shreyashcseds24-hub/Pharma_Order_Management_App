import api, { API_BASE_URL, USE_MOCK_API, tokenStore } from './api'

/**
 * Client for the authenticated AI assistant.
 *
 * There is intentionally no mock fallback: a fake answer would look like real
 * analysis. When the app runs in demo mode the UI tells the user that the
 * assistant needs the Flask backend instead of inventing a response.
 */
export const AI_CHAT_AVAILABLE = !USE_MOCK_API

// A local/hosted model can spend minutes loading and generating an answer.
// The shared Axios client uses a 15s timeout for ordinary CRUD calls, which
// would abort a valid assistant response before the backend can finish.
// The same ceiling is applied to the streaming request below.
export const AI_CHAT_TIMEOUT_MS = 330000

export const getAIStatus = async () => {
  const { data } = await api.get('/ai/status')
  return data
}

export const sendAIMessage = async ({ message, conversationId }) => {
  const payload = { message }
  if (conversationId) payload.conversation_id = conversationId
  const { data } = await api.post('/ai/chat', payload, { timeout: AI_CHAT_TIMEOUT_MS })
  return data
}

/**
 * Stream one assistant turn from the SSE endpoint.
 *
 * `onEvent` receives `{ type: 'status' | 'delta' | 'done', ... }`. The promise
 * resolves only with the final `done` event, after the backend has persisted
 * the assistant message. Interrupting via `signal` aborts the HTTP request;
 * the backend persists any text it already produced as an interrupted answer.
 */
export const sendAIMessageStream = async ({
  message,
  conversationId,
  onEvent,
  signal,
}) => {
  const payload = { message }
  if (conversationId) payload.conversation_id = conversationId

  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, AI_CHAT_TIMEOUT_MS)

  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const token = tokenStore.get()
  try {
    const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      let message = `The assistant could not answer (HTTP ${response.status}).`
      try {
        const body = await response.json()
        if (body?.message) message = body.message
      } catch {
        /* keep the generic message for non-JSON errors */
      }
      throw new Error(message)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Streaming responses are not supported by this browser.')

    const decoder = new TextDecoder()
    let buffer = ''
    let doneEvent = null

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        let eventName = 'message'
        const dataLines = []
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
        }
        if (dataLines.length) {
          const event = JSON.parse(dataLines.join('\n'))
          if (eventName === 'error') {
            throw new Error(event.message || 'The assistant could not answer.')
          }
          onEvent?.({ ...event, event: eventName })
          if (event.type === 'done') doneEvent = event
        }
        boundary = buffer.indexOf('\n\n')
      }
    }

    if (!doneEvent) throw new Error('The assistant stopped before finishing the answer.')
    return doneEvent
  } catch (error) {
    if (error?.name === 'AbortError' && timedOut) {
      throw new Error('The assistant took too long to answer. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export const listAIConversations = async () => {
  const { data } = await api.get('/ai/conversations')
  return data
}

export const getAIConversation = async (conversationId) => {
  const { data } = await api.get(`/ai/conversations/${conversationId}`)
  return data
}
