module.exports = {
	apps: [
		{
			name: 'lf-web',
			script: 'build/index.js',
			env: {
				NODE_ENV: 'production',
				PORT: 3001,
				HOST: '0.0.0.0'
			}
		}
	]
};
