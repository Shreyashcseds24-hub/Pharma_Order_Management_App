import { useEffect } from 'react'

const BASE_TITLE = 'MediFlow AI'

/**
 * Lightweight document title helper - avoids pulling in react-helmet
 * since the app only needs a per-page title.
 */
export const Helmet = ({ title, description }) => {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE
    if (description) {
      let tag = document.querySelector('meta[name="description"]')
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', 'description')
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', description)
    }
  }, [title, description])

  return null
}

export default Helmet