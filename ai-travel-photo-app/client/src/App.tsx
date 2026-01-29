import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// 页面组件
import Home from "./pages/Home";
import TemplateDetail from "./pages/TemplateDetail";
import TemplateSelect from "./pages/TemplateSelect";
import Camera from "./pages/Camera";
import Generating from "./pages/Generating";
import PhotoResult from "./pages/PhotoResult";
import Result from "./pages/Result";
import Profile from "./pages/Profile";
import MyPhotos from "./pages/MyPhotos";

// 管理后台
import AdminDashboard from "./pages/admin/Dashboard";
import AdminTemplates from "./pages/admin/Templates";
import AdminTemplateConfig from "./pages/admin/TemplateConfig";
import AdminChannels from "./pages/admin/Channels";
import AdminOrders from "./pages/admin/Orders";
import AdminUsers from "./pages/admin/Users";
import AdminCitySpots from "./pages/admin/CitySpots";
import AdminShareConfig from "./pages/admin/ShareConfig";
import AdminIpImage from "./pages/admin/IpImage";
import AdminSystemParams from "./pages/admin/SystemParams";
import AdminGroupTypes from "./pages/admin/GroupTypes";
import AdminTemplateStats from "./pages/admin/TemplateStats";
import AdminChannelStats from "./pages/admin/ChannelStats";
import AdminOrderResults from "./pages/admin/OrderResults";
import AdminChangePassword from "./pages/admin/settings/ChangePassword";
import AdminApiConfig from "./pages/admin/ApiConfig";

// 渠道门户
import ChannelLogin from "./pages/channel/Login";
import ChannelDashboard from "./pages/channel/Dashboard";
import ChannelPortalDashboard from "./pages/channel-portal/Dashboard";
import ChannelPortalOrders from "./pages/channel-portal/Orders";
import ChannelPortalPromotion from "./pages/channel-portal/Promotion";
import ChannelPortalSales from "./pages/channel-portal/Sales";
import ChannelPortalSettings from "./pages/channel-portal/Settings";

// 推广员门户
import SalesPortalDashboard from "./pages/sales-portal/Dashboard";
import SalesPortalOrders from "./pages/sales-portal/Orders";
import SalesPortalPromotion from "./pages/sales-portal/Promotion";
import SalesPortalSettings from "./pages/sales-portal/Settings";

// 公开分享页面
import ShareResults from "./pages/ShareResults";
import ShareTemplates from "./pages/ShareTemplates";

function Router() {
  return (
    <Switch>
      {/* 用户端页面 */}
      <Route path="/" component={Home} />
      <Route path="/app" component={Home} /> {/* 推广链接入口 */}
      <Route path="/template/:id" component={TemplateDetail} />
      <Route path="/templates" component={TemplateSelect} />
      <Route path="/camera" component={Camera} />
      <Route path="/generating" component={Generating} />
      <Route path="/generating/:photoId" component={Generating} />
      <Route path="/result" component={Result} />
      <Route path="/result/:photoId" component={PhotoResult} />
      <Route path="/profile" component={Profile} />
      <Route path="/profile/photos" component={MyPhotos} />
      
      {/* 管理后台 - /admin 作为统一登录入口 */}
      <Route path="/admin" component={ChannelLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/templates" component={AdminTemplates} />
      <Route path="/admin/templates/config" component={AdminTemplateConfig} />
      <Route path="/admin/templates/stats" component={AdminTemplateStats} />
      <Route path="/admin/channels" component={AdminChannels} />
      <Route path="/admin/channels/stats" component={AdminChannelStats} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/order-results/:orderId" component={AdminOrderResults} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/settings/city-spots" component={AdminCitySpots} />
      <Route path="/admin/settings/share" component={AdminShareConfig} />
      <Route path="/admin/settings/ip-image" component={AdminIpImage} />
      <Route path="/admin/settings/params" component={AdminSystemParams} />
      <Route path="/admin/settings/group-types" component={AdminGroupTypes} />
      <Route path="/admin/settings/change-password" component={AdminChangePassword} />
      <Route path="/admin/settings/api-config" component={AdminApiConfig} />
      
      {/* 渠道门户 */}
      <Route path="/channel/login" component={ChannelLogin} />
      <Route path="/channel/dashboard" component={ChannelDashboard} />
      
      {/* 渠道门户（新版） */}
      <Route path="/channel-portal" component={ChannelPortalDashboard} />
      <Route path="/channel-portal/dashboard" component={ChannelPortalDashboard} />
      <Route path="/channel-portal/orders" component={ChannelPortalOrders} />
      <Route path="/channel-portal/promotion" component={ChannelPortalPromotion} />
      <Route path="/channel-portal/sales" component={ChannelPortalSales} />
      <Route path="/channel-portal/settings" component={ChannelPortalSettings} />
      
      {/* 推广员门户 */}
      <Route path="/sales-portal" component={SalesPortalDashboard} />
      <Route path="/sales-portal/dashboard" component={SalesPortalDashboard} />
      <Route path="/sales-portal/orders" component={SalesPortalOrders} />
      <Route path="/sales-portal/promotion" component={SalesPortalPromotion} />
      <Route path="/sales-portal/settings" component={SalesPortalSettings} />
      
      {/* 公开分享页面 */}
      <Route path="/share/results/:orderId" component={ShareResults} />
      <Route path="/share/templates/:orderId" component={ShareTemplates} />
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
