const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.length > 0 ? ' ' + args.map(a => 
    typeof a === 'object' ? JSON.stringify(a) : a
  ).join(' ') : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
}

const logger = {
  debug: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message, ...args));
    }
  },
  
  info: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, ...args));
    }
  },
  
  warn: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, ...args));
    }
  },
  
  error: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, ...args));
    }
  },
};

module.exports = logger;

