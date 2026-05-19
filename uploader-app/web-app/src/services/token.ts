import { jwtDecode } from 'jwt-decode'

export interface DecodedToken {
  scope?: string[]
  role?: string
  exp?: number // Token expiry timestamp
  iat?: number // Token issued-at timestamp
  sub?: string // Subject (user ID)
}

export const getDecodedToken = (token: string | null): DecodedToken | null => {
  if (!token) {
    return null
  }

  try {
    return jwtDecode<DecodedToken>(token)
  } catch (error) {
    console.error('Invalid JWT token', error)
    return null
  }
}
