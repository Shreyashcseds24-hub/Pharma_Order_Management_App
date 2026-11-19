import api, { USE_MOCK_API } from './api'

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
const AI_CHAT_TIMEOUT_MS = 330000

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

export const listAIConversations = async () => {
  const { data } = await api.get('/ai/conversations')
  return data
}

export const getAIConversation = async (conversationId) => {
  const { data } = await api.get(`/ai/conversations/${conversationId}`)
  return data
}
