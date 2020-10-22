const path = require('path')

const listen_ip = '0.0.0.0'
const listen_port = 61000

const tmp_dir = '/upload'

const public_dir = path.join(rootDir, 'public')

const image_dir = public_dir
const video_dir = '/cdn'
const import_dir = path.join(public_dir, 'import')

const image_url = "http://static.shoppingtv.vn/dev"
const video_url = "https://tvcommerce-st.fptplay.net/dev"

module.exports = {
  fastify_options: {
    logger: true,
    http2: true
  },
  static_routes: [
    { prefix: '/', root: '/cms' },
    { prefix: '/cdn/images', root: `${image_dir}/images` },
    { prefix: '/cdn/videos', root: `${video_dir}/videos` },
  ],
  apiPrefix: '/api',
  alpha_grpc: require('./alpha'),
  tmp_dir,
  image_dir,
  image_url,
  video_dir,
  video_url,
  import_dir,
  listen_ip,
  listen_port
}