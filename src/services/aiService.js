import api, { USE_MOCK_API } from './api'

/**
 * Client for the authenticated AI assistant.
 *
 * There is intentionally no mock fallback: a fake answer would look like real
 * analysis. When the app runs in demo mode the UI tells the user that the
 * assistant needs the Flask backend instead of inventing a response.
 */
export const AI_CHAT_AVAILABLE = !USE_MOCK_API

export const getAIStatus = async () => {
  const { data } = await api.get('/ai/status')
  return data
}

export const sendAIMessage = async ({ message, conversationId }) => {
  const payload = { message }
  if (conversationId) payload.conversation_id = conversationId
  const { data } = await api.post('/ai/chat', payload)
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
