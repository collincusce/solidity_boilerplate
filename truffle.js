module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id,
      //gas: 4712388
      gas: 80000000
    },
    production: {
      host: 'localhost',
      port: 8544,
      network_id: '*',
      network_id: "155",
      from: "0x92a998e2d04497ad3a453aaf3da9b1e86e04bc67",
      gas: 80000000
    },
    kovan: {
      host: 'localhost',
      port: 8546,
      network_id: '42',
      gas: 4712388
    }
  },
  test_directory: 'transpiled/test',
  migrations_directory: 'transpiled/migrations'
}
