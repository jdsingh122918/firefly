"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Bell,
  RefreshCw,
  Wifi,
  WifiOff,
  Send,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DebugData {
  summary: {
    timeRange: string;
    startTime: string;
    activeConnections: number;
    deliverySuccessRate: string;
  };
  connections: {
    total: number;
    byUser: Record<string, number>;
    averageAgeMs: number;
    details: Array<{
      connectionId: string;
      userId: string;
      connectedAt: string;
      lastHeartbeat: string;
      heartbeatCount: number;
      messagesDelivered: number;
      isHealthy: boolean;
    }>;
  };
  deliveryMetrics: {
    total: number;
    delivered: number;
    failed: number;
    polled: number;
    pending: number;
    latency: {
      avg: number | null;
      max: number | null;
      min: number | null;
    };
  };
  recentDeliveries: Array<{
    id: string;
    notificationId: string;
    notificationType: string;
    notificationTitle: string;
    status: string;
    wasConnected: boolean;
    connectionId: string | null;
    latencyMs: number | null;
    error: string | null;
    createdAt: string;
    deliveredAt: string | null;
  }>;
  pipelineLogs: Array<{
    timestamp: string;
    level: string;
    event: string;
    notificationId: string | null;
    userId: string | null;
    connectionId: string | null;
    latencyMs: number | null;
    error: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}

export default function NotificationDebugPage() {
  const { getToken } = useAuth();
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("1h");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Test notification state
  const [testTitle, setTestTitle] = useState("Test Notification");
  const [testMessage, setTestMessage] = useState("This is a test notification from the debug dashboard.");
  const [testType, setTestType] = useState("SYSTEM_ANNOUNCEMENT");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchDebugData = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/notifications/debug?timeRange=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setDebugData(data.data);
        setError(null);
      } else {
        throw new Error(data.error || "Failed to fetch debug data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch debug data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getToken, timeRange]);

  useEffect(() => {
    fetchDebugData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchDebugData, 10000);
    return () => clearInterval(interval);
  }, [fetchDebugData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDebugData();
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);

    try {
      const token = await getToken();
      const response = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: testTitle,
          message: testMessage,
          type: testType,
        }),
      });

      const data = await response.json();
      setTestResult(data);

      // Refresh debug data after sending test
      setTimeout(fetchDebugData, 1000);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to send test",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("Are you sure you want to clean up old delivery logs?")) return;

    try {
      const token = await getToken();
      const response = await fetch("/api/admin/notifications/debug?olderThanDays=7", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        alert(`Cleaned up ${data.deletedCount} old logs`);
        fetchDebugData();
      }
    } catch (_err) {
      alert("Failed to cleanup logs");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notification Debug Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor real-time notification delivery and connection health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="destructive" onClick={handleCleanup}>
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Wifi className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Connections</p>
                <p className="text-2xl font-bold">{debugData?.connections.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivery Rate</p>
                <p className="text-2xl font-bold">{debugData?.summary.deliverySuccessRate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Latency</p>
                <p className="text-2xl font-bold">
                  {debugData?.deliveryMetrics.latency.avg
                    ? `${debugData.deliveryMetrics.latency.avg}ms`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{debugData?.deliveryMetrics.pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Connections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Connections
            </CardTitle>
            <CardDescription>
              Real-time SSE connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            {debugData?.connections.details.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active connections</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {debugData?.connections.details.map((conn) => (
                  <div
                    key={conn.connectionId}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {conn.isHealthy ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-mono">{conn.connectionId.slice(-12)}</p>
                        <p className="text-xs text-muted-foreground">
                          {conn.messagesDelivered} msgs, {conn.heartbeatCount} heartbeats
                        </p>
                      </div>
                    </div>
                    <Badge variant={conn.isHealthy ? "default" : "destructive"}>
                      {conn.isHealthy ? "Healthy" : "Unhealthy"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Notification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Test Notification
            </CardTitle>
            <CardDescription>
              Test the notification pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MESSAGE">Message</SelectItem>
                  <SelectItem value="CARE_UPDATE">Care Update</SelectItem>
                  <SelectItem value="SYSTEM_ANNOUNCEMENT">System Announcement</SelectItem>
                  <SelectItem value="FAMILY_ACTIVITY">Family Activity</SelectItem>
                  <SelectItem value="EMERGENCY_ALERT">Emergency Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleSendTest}
              disabled={isSendingTest}
            >
              {isSendingTest ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test
            </Button>

            {testResult && (
              <div
                className={cn(
                  "p-3 rounded-lg text-sm",
                  testResult.success
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                )}
              >
                {testResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      Notification sent! SSE delivered:{" "}
                      {testResult.data?.sseDelivered ? "Yes" : "No (will poll)"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{testResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivery Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Metrics ({timeRange})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-foreground">
                {debugData?.deliveryMetrics.total || 0}
              </p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600">
                {debugData?.deliveryMetrics.delivered || 0}
              </p>
              <p className="text-sm text-muted-foreground">SSE Delivered</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">
                {debugData?.deliveryMetrics.polled || 0}
              </p>
              <p className="text-sm text-muted-foreground">Polled</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-600">
                {debugData?.deliveryMetrics.failed || 0}
              </p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-orange-600">
                {debugData?.deliveryMetrics.pending || 0}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Connected</th>
                  <th className="text-left p-2">Latency</th>
                  <th className="text-left p-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {debugData?.recentDeliveries.slice(0, 10).map((delivery) => (
                  <tr key={delivery.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      <Badge variant="outline">{delivery.notificationType}</Badge>
                    </td>
                    <td className="p-2 max-w-xs truncate">{delivery.notificationTitle}</td>
                    <td className="p-2">
                      <Badge
                        variant={
                          delivery.status === "DELIVERED"
                            ? "default"
                            : delivery.status === "POLLED"
                            ? "secondary"
                            : delivery.status === "FAILED"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {delivery.status}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {delivery.wasConnected ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-gray-400" />
                      )}
                    </td>
                    <td className="p-2">
                      {delivery.latencyMs ? `${delivery.latencyMs}ms` : "-"}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {new Date(delivery.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Logs</CardTitle>
          <CardDescription>Real-time notification pipeline events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
            {debugData?.pipelineLogs.slice(0, 30).map((log, i) => (
              <div
                key={i}
                className={cn(
                  "p-1 rounded",
                  log.level === "ERROR" && "bg-red-100 text-red-800",
                  log.level === "WARN" && "bg-yellow-100 text-yellow-800",
                  log.level === "INFO" && "bg-gray-100",
                  log.level === "DEBUG" && "bg-gray-50 text-gray-600"
                )}
              >
                <span className="text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>{" "}
                <span className="font-semibold">[{log.level}]</span>{" "}
                <span>{log.event}</span>
                {log.latencyMs && <span className="text-blue-600"> ({log.latencyMs}ms)</span>}
                {log.error && <span className="text-red-600"> - {log.error}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
