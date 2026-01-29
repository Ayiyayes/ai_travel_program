import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo } from "react";

/**
 * 管理员认证 Hook
 * 支持两种认证方式:
 * 1. OAuth 认证 (通过 useAuth)
 * 2. 渠道登录系统的超级管理员认证 (通过 localStorage)
 */
export function useAdminAuth() {
  const { loading: oauthLoading, user: oauthUser, ...rest } = useAuth();

  const adminState = useMemo(() => {
    // 优先检查渠道登录系统的超级管理员
    const token = localStorage.getItem("channelToken");
    const userStr = localStorage.getItem("channelUser");

    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr);

        // 如果是超级管理员,转换为 admin 角色
        if (userData.role === 'superadmin') {
          return {
            user: {
              id: userData.id,
              name: userData.username,
              email: '',
              role: 'admin' as const,
              avatar: null,
            },
            loading: false,
            isAuthenticated: true,
          };
        }
      } catch (e) {
        console.error('[useAdminAuth] Parse error:', e);
      }
    }

    // 如果没有渠道登录,使用 OAuth 认证
    return {
      user: oauthUser,
      loading: oauthLoading,
      isAuthenticated: Boolean(oauthUser),
    };
  }, [oauthUser, oauthLoading]);

  return {
    ...adminState,
    ...rest,
  };
}
