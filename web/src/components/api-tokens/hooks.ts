import { useQuery } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { ApiToken } from '@/api/types'

import type { ScopeResource } from './modals/scopes.utils'

export const tokensKey = ['api-tokens']

export const useApiTokens = () => useQuery({ queryKey: tokensKey, queryFn: () => api.get<{ tokens: ApiToken[] }>('api-tokens') })

export const useTokenScopes = () =>
    useQuery({
        queryKey: ['api-tokens', 'scopes'],
        queryFn: () => api.get<{ resources: ScopeResource[] }>('api-tokens/scopes'),
        staleTime: Infinity
    })

export const isMobileViewport = () => window.matchMedia('(max-width: 40em)').matches
