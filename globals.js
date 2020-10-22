"use strict"

// if(!process.env.ENV) {
//   throw new Error('Chưa set biến môi trường ENV')
// }

global.mrequire = require.main.require

global.rootDir = __dirname
global.config = require('./config')
// global.emitSync = require('./services/sync-partner')
// global.emitDumpDB = require('./services/backup-data/dump_db')
// global.emitRecoveryDB = require('./services/backup-data/recovery_db')