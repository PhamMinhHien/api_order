
const path = require('path')

const listen_ip = '0.0.0.0'
const listen_port = 61000

// const tmp_dir = path.join(rootDir, 'upload')

// const public_dir = path.join(rootDir, 'public')

// const image_dir = public_dir
// const video_dir = public_dir

// const import_dir = path.join(public_dir, 'import')

// const image_url = `http://localhost:${listen_port}/image`
// const video_url = `http://localhost:${listen_port}/video`

module.exports = {
  // fastify_options: {
  //   logger: true,
  //   http2: false
  // },
  // static_routes: [
  //   {
  //     prefix: '/cdn',
  //     root: public_dir
  //   },
  //   {
  //     prefix: '/login',
  //     root: path.join(rootDir, 'public', 'login'),
  //     decorateReply: false // cái thứ 2 trở lên bắt buộc phải có
  //   }
  // ],
  // proxy_routes: [
  //   {
  //     prefix: '/',
  //     upstream: 'http://host.docker.internal:3000',
  //     websocket: true,
  //     http2: false
  //   }
  // ],
  apiPrefix: '/api',
  alpha_grpc: ["alpha:9080"],
  // alpha_grpc: require('./alpha'),
  // tmp_dir,
  // image_dir,
  // image_url,
  // video_dir,
  // video_url,
  // import_dir,
  listen_ip,
  listen_port
}