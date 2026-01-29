import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Image,
  Settings2,
  Building2,
  Users,
  ShoppingCart,
  BarChart3,
  Settings,
  MapPin,
  Share2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  UserCircle,
  Key,
  Plug,
} from "lucide-react";
import { CSSProperties, useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

// 渠道登录系统的用户类型
interface ChannelUser {
  id: number;
  username: string;
  role: string;
  channelId?: number;
  salesId?: number;
  mustChangePassword: boolean;
  channelName?: string;
  channelCode?: string;
  channelType?: string;
  salesName?: string;
  salesCode?: string;
}

// 后台管理菜单配置
const adminMenuGroups = [
  {
    label: "概览",
    items: [
      { icon: LayoutDashboard, label: "管理仪表盘", path: "/admin/dashboard" },
    ],
  },
  {
    label: "模板管理",
    items: [
      { icon: Image, label: "模板列表", path: "/admin/templates" },
      { icon: Settings2, label: "模板配置", path: "/admin/templates/config" },
      { icon: BarChart3, label: "模板统计", path: "/admin/templates/stats" },
    ],
  },
  {
    label: "渠道管理",
    items: [
      { icon: Building2, label: "渠道列表", path: "/admin/channels" },
      { icon: BarChart3, label: "渠道统计", path: "/admin/channels/stats" },
    ],
  },
  {
    label: "业务管理",
    items: [
      { icon: ShoppingCart, label: "订单管理", path: "/admin/orders" },
      { icon: Users, label: "用户管理", path: "/admin/users" },
    ],
  },
  {
    label: "系统设置",
    items: [
      { icon: MapPin, label: "城市景点", path: "/admin/settings/city-spots" },
      { icon: Share2, label: "分享配置", path: "/admin/settings/share" },
      { icon: Sparkles, label: "IP形象", path: "/admin/settings/ip-image" },
      { icon: UserCircle, label: "人群类型", path: "/admin/settings/group-types" },
      { icon: Settings, label: "系统参数", path: "/admin/settings/params" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "admin-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user: oauthUser } = useAuth();
  const [location, setLocation] = useLocation();
  const [channelUser, setChannelUser] = useState<ChannelUser | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  


  // 检查渠道登录系统的超级管理员
  useEffect(() => {
    const token = localStorage.getItem("channelToken");
    const userStr = localStorage.getItem("channelUser");

    console.log('[AdminLayout] Token:', token);
    console.log('[AdminLayout] UserStr:', userStr);

    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr);
        console.log('[AdminLayout] Parsed userData:', userData);
        console.log('[AdminLayout] userData.role:', userData.role);

        // 检查是否为超级管理员
        if (userData.role === 'superadmin') {
          console.log('[AdminLayout] Setting channelUser (superadmin)');
          setChannelUser(userData);
        } else {
          console.log('[AdminLayout] Role is not superadmin, role is:', userData.role);
        }
      } catch (e) {
        console.error('[AdminLayout] Parse error:', e);
      }
    }
    setChannelLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // 等待两种认证方式都检查完成
  if (loading || channelLoading) {
    return <DashboardLayoutSkeleton />;
  }

  // 优先使用渠道登录系统的超级管理员
  // 直接从 localStorage 读取,避免 state 更新延迟问题
  let user = oauthUser;
  const token = localStorage.getItem("channelToken");
  const userStr = localStorage.getItem("channelUser");

  console.log('[AdminLayout Render] oauthUser:', oauthUser);
  console.log('[AdminLayout Render] token:', token);
  console.log('[AdminLayout Render] userStr:', userStr);

  if (token && userStr) {
    try {
      const userData = JSON.parse(userStr);
      console.log('[AdminLayout Render] Parsed userData:', userData);
      console.log('[AdminLayout Render] userData.role:', userData.role);

      if (userData.role === 'superadmin') {
        user = {
          isNewUser: false,
          id: userData.id,
          openId: `channel_${userData.id}`,
          name: userData.username,
          email: '',
          avatar: null,
          loginMethod: 'channel',
          role: 'admin' as const,
          points: 0,
          initialFreeCredits: 0,
          hasUsedFreeCredits: false,
          channelId: null,
          salesId: null,
          promotionCodeId: null,
          gender: null,
          userType: null,
          faceType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          lastSelfieUrl: null,
          lastSelfieTime: null,
        };
        console.log('[AdminLayout Render] Created user with admin role:', user);
      }
    } catch (e) {
      console.error('[AdminLayout Render] Parse error:', e);
      // 解析失败，使用 oauthUser
    }
  }

  console.log('[AdminLayout Render] Final user:', user);
  console.log('[AdminLayout Render] Final user.role:', user?.role);

  if (!user) {
    // 直接跳转到登录页面
    if (typeof window !== 'undefined' && location !== '/admin') {
      setLocation('/admin');
    }
    return null;
  }

  // 检查管理员权限
  if (user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fdf9f6]">
        <div className="flex flex-col items-center gap-4 p-8 max-w-2xl">
          <h1 className="text-xl font-semibold text-[#6f5d55]">无权访问</h1>
          <p className="text-muted-foreground">您没有管理员权限</p>

          {/* 调试信息 */}
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg w-full">
            <p className="text-sm font-semibold mb-2">调试信息:</p>
            <div className="text-xs space-y-1">
              <p>用户ID: {user.id}</p>
              <p>用户名: {user.name}</p>
              <p className="text-red-600 font-bold">当前角色: {user.role}</p>
              <p>channelUser存在: {channelUser ? '是' : '否'}</p>
              {channelUser && (
                <p className="text-blue-600">channelUser角色: {channelUser.role}</p>
              )}
              <p className="mt-2 text-gray-500">需要的角色: admin</p>
            </div>
          </div>

          <Link href="/">
            <Button variant="outline">返回首页</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": `${sidebarWidth}px`,
      } as CSSProperties}
    >
      <Sidebar className="border-r border-[#e8ddd8]">
        <SidebarHeader className="border-b border-[#e8ddd8] p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#e89a8d] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-[#6f5d55]">AI旅拍管理</h2>
              <p className="text-xs text-muted-foreground">后台管理系统</p>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="p-2">
          {adminMenuGroups.map((group, groupIndex) => (
            <SidebarGroup key={groupIndex}>
              <SidebarGroupLabel className="text-xs text-muted-foreground px-2 py-1">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item, itemIndex) => {
                    const isActive = location === item.path ||
                      (item.path !== '/admin/dashboard' && location.startsWith(item.path));
                    return (
                      <SidebarMenuItem key={itemIndex}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.path}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-[#e8ddd8] p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-[#f5ebe6] transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[#e89a8d] text-white">
                    {user.name?.[0]?.toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-[#6f5d55]">{user.name || '管理员'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email || ''}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/" className="flex items-center gap-2">
                  <PanelLeft className="w-4 h-4" />
                  返回前台
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/settings/api-config" className="flex items-center gap-2">
                  <Plug className="w-4 h-4" />
                  API配置
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/settings/change-password" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  修改密码
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 cursor-pointer"
                onClick={() => {
                  // 清除登录状态
                  localStorage.removeItem('channelToken');
                  localStorage.removeItem('channelUser');
                  // 跳转到登录页面
                  window.location.href = '/admin';
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#fdf9f6]">
        <header className="flex h-10 items-center gap-2 border-b border-[#e8ddd8] bg-white/50 px-3">
          <SidebarTrigger className="h-7 w-7" />
        </header>
        <main className="flex-1 p-4 overflow-auto">
          {children}
        </main>
      </SidebarInset>


    </SidebarProvider>
  );
}
