using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace ShortStickGame.Api.Services;

public interface IGameWebSocketManager
{
    Task HandleClientAsync(HttpContext context);
    Task BroadcastAsync(Guid gameId, string type, object payload);
}

public class GameWebSocketManager : IGameWebSocketManager
{
    private class Client
    {
        public required WebSocket Socket { get; init; }
        public HashSet<Guid> Subscriptions { get; } = new();
    }

    private readonly ConcurrentDictionary<string, Client> _clients = new(); // key: connection id

    public async Task HandleClientAsync(HttpContext context)
    {
        using var socket = await context.WebSockets.AcceptWebSocketAsync();
        var connectionId = Guid.NewGuid().ToString("n");
        var client = new Client { Socket = socket };
        _clients[connectionId] = client;
        try
        {
            var buffer = new byte[4096];
            while (socket.State == WebSocketState.Open)
            {
                var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), context.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }

                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                try
                {
                    var doc = JsonDocument.Parse(message);
                    if (doc.RootElement.TryGetProperty("type", out var typeEl))
                    {
                        var type = typeEl.GetString()?.ToLowerInvariant();
                        if (type == "subscribe")
                        {
                            if (doc.RootElement.TryGetProperty("gameId", out var gidEl) && Guid.TryParse(gidEl.GetString(), out var gid))
                            {
                                client.Subscriptions.Add(gid);
                                await SendAsync(socket, new { type = "subscribed", gameId = gid });
                            }
                        }
                        else if (type == "unsubscribe")
                        {
                            if (doc.RootElement.TryGetProperty("gameId", out var gidEl) && Guid.TryParse(gidEl.GetString(), out var gid))
                            {
                                client.Subscriptions.Remove(gid);
                                await SendAsync(socket, new { type = "unsubscribed", gameId = gid });
                            }
                        }
                        else if (type == "ping")
                        {
                            await SendAsync(socket, new { type = "pong", ts = DateTimeOffset.UtcNow });
                        }
                    }
                }
                catch
                {
                    // ignore malformed messages
                }
            }
        }
        finally
        {
            _clients.TryRemove(connectionId, out _);
            try { await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None); } catch { }
        }
    }

    public async Task BroadcastAsync(Guid gameId, string type, object payload)
    {
        var json = JsonSerializer.Serialize(new { type, gameId, payload });
        var bytes = Encoding.UTF8.GetBytes(json);
        var segment = new ArraySegment<byte>(bytes);

        var dead = new List<string>();
        foreach (var kvp in _clients)
        {
            var id = kvp.Key;
            var client = kvp.Value;
            var socket = client.Socket;
            if (socket.State != WebSocketState.Open)
            {
                dead.Add(id);
                continue;
            }
            if (!client.Subscriptions.Contains(gameId)) continue;
            try
            {
                await socket.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch
            {
                dead.Add(id);
            }
        }

        foreach (var id in dead)
        {
            _clients.TryRemove(id, out _);
        }
    }

    private static Task SendAsync(WebSocket socket, object obj)
    {
        var json = JsonSerializer.Serialize(obj);
        var bytes = Encoding.UTF8.GetBytes(json);
        return socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }
}
