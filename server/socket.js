/**
 * ============================================================================
 * Socket.io Configuration - Environment-Aware
 * ============================================================================
 * Handles real-time communication between server and clients
 * Works in both Development and Production environments
 */

const socketIO = require('socket.io');

let io;

/**
 * ✅ Initialize Socket.io with Express server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.io instance
 */
function initializeSocket(server) {
    const isDev = process.env.NODE_ENV === 'development';
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5000';

    // ✅ Dynamic CORS based on environment
    const corsOptions = isDev
        ? {
              // Development: Allow multiple origins (localhost variations)
              origin: [
                  clientUrl,
                  'http://localhost:5000',
                  'http://127.0.0.1:5000',
                  'http://localhost:3000' // If you use different ports
              ],
              methods: ['GET', 'POST'],
              credentials: true
          }
        : {
              // Production: Only allow your domain
              origin: clientUrl,
              methods: ['GET', 'POST'],
              credentials: true
          };

    // ✅ Initialize Socket.io
    io = socketIO(server, {
        cors: corsOptions,
        path: process.env.SOCKET_PATH || '/socket.io/',
        transports: ['websocket', 'polling'],
        pingTimeout: 60000, // 60 seconds
        pingInterval: 25000, // 25 seconds
        upgradeTimeout: 30000, // 30 seconds
        maxHttpBufferSize: 1e6 // 1 MB
    });

    // ✅ Connection handler
    io.on('connection', (socket) => {
        console.log('\n✅ ════════════════════════════════════════════════════════');
        console.log('✅ [SOCKET] New client connected');
        console.log('✅ ════════════════════════════════════════════════════════');
        console.log('   Socket ID:', socket.id);
        console.log('   Environment:', process.env.NODE_ENV || 'unknown');
        console.log('   Origin:', socket.handshake.headers.origin || 'unknown');
        console.log('   Transport:', socket.conn.transport.name);
        console.log(
            '   User Agent:',
            socket.handshake.headers['user-agent']?.substring(0, 50) + '...'
        );
        console.log('✅ ════════════════════════════════════════════════════════\n');

        // ================================================================
        // ✅ JOIN USER-SPECIFIC ROOM
        // ================================================================
        socket.on('join', (userId) => {
            // if (userId && typeof userId === 'string') {
            if (typeof userId === 'string' && userId.trim() !== '') {
                const roomName = `user_${userId}`;
                socket.join(roomName);
                console.log(`✅ [SOCKET] User ${userId} joined room: ${roomName}`);

                // Confirm join
                socket.emit('joined', {
                    room: roomName,
                    userId: userId,
                    message: 'Successfully joined user room'
                });
            } else {
                console.warn('⚠️  [SOCKET] Invalid userId provided for join');
            }
        });

        // ================================================================
        // ✅ DISCONNECT HANDLER
        // ================================================================
        socket.on('disconnect', (reason) => {
            console.log('\n❌ ════════════════════════════════════════════════════════');
            console.log('❌ [SOCKET] Client disconnected');
            console.log('❌ ════════════════════════════════════════════════════════');
            console.log('   Socket ID:', socket.id);
            console.log('   Reason:', reason);
            console.log('   Time:', new Date().toISOString());
            console.log('❌ ════════════════════════════════════════════════════════\n');
        });

        // ================================================================
        // ✅ PING/PONG TEST (for debugging)
        // ================================================================
        socket.on('ping', () => {
            console.log('📡 [SOCKET] Ping received from:', socket.id);
            socket.emit('pong', {
                message: 'Server is alive!',
                environment: process.env.NODE_ENV || 'unknown',
                timestamp: new Date().toISOString(),
                serverTime: Date.now()
            });
        });

        // ================================================================
        // ✅ ERROR HANDLER
        // ================================================================
        socket.on('error', (error) => {
            console.error('❌ [SOCKET] Socket error:', error);
        });
    });

    // ✅ Log initialization success
    console.log('\n🚀 ════════════════════════════════════════════════════════');
    console.log('🚀 [SOCKET] Socket.io initialized successfully');
    console.log('🚀 ════════════════════════════════════════════════════════');
    console.log('   Environment:', process.env.NODE_ENV || 'development');
    console.log(
        '   CORS Origins:',
        Array.isArray(corsOptions.origin) ? corsOptions.origin.join(', ') : corsOptions.origin
    );
    console.log('   Path:', process.env.SOCKET_PATH || '/socket.io/');
    console.log('   Transports:', 'websocket, polling');
    console.log('🚀 ════════════════════════════════════════════════════════\n');

    return io;
}

/**
 * ✅ Get Socket.io instance (for use in other modules)
 * @returns {Object} Socket.io instance
 * @throws {Error} If Socket.io not initialized
 */
function getIO() {
    if (!io) {
        throw new Error('❌ Socket.io not initialized! Call initializeSocket() first.');
    }
    return io;
}

/**
 * ✅ Emit to a specific user room (user_<userId>)
 * @param {string|number} userId
 * @param {string} event
 * @param {any} payload
 */
function emitToUser(userId, event, payload) {
    if (!io) return;
    if (userId == null) return;

    const roomName = `user_${String(userId)}`;
    io.to(roomName).emit(event, payload);
}

module.exports = { initializeSocket, getIO, emitToUser };
