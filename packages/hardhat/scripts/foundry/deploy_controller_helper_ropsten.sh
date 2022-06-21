# ETHERSCAN_API_KEY=PSW8C433Q667DVEX5BCRMGNAH9FSGFZ7Q8 forge create --rpc-url https://ropsten.infura.io/v3/9a1eacc6b18f436dab839c1713616fd1 \
# --private-key 3c4116deff9bd023a710b33313cc4d1a360ed887e5e83650870de392fc45eb28 \
# contracts/libs/TickMathExternal.sol:TickMathExternal \
# --verify

# # 0x3df2b43b66d96409cad7f23bf5f699bae1aad144


# ETHERSCAN_API_KEY=PSW8C433Q667DVEX5BCRMGNAH9FSGFZ7Q8 forge create --rpc-url https://ropsten.infura.io/v3/9a1eacc6b18f436dab839c1713616fd1 \
# --private-key 3c4116deff9bd023a710b33313cc4d1a360ed887e5e83650870de392fc45eb28 \
# contracts/libs/SqrtPriceMathPartial.sol:SqrtPriceMathPartial \
# --verify

# # 0xafff7ba0904978c1c4bb49773e24dd8da57abcc6

# ETHERSCAN_API_KEY=PSW8C433Q667DVEX5BCRMGNAH9FSGFZ7Q8 forge create --rpc-url https://ropsten.infura.io/v3/9a1eacc6b18f436dab839c1713616fd1 \
# --private-key 3c4116deff9bd023a710b33313cc4d1a360ed887e5e83650870de392fc45eb28 \
# contracts/periphery/lib/ControllerHelperUtil.sol:ControllerHelperUtil \
# --libraries contracts/libs/SqrtPriceMathPartial.sol:SqrtPriceMathPartial:0xafff7ba0904978c1c4bb49773e24dd8da57abcc6 \
# --libraries contracts/libs/TickMathExternal.sol:TickMathExternal:0x3df2b43b66d96409cad7f23bf5f699bae1aad144 \
# --verify

forge create --rpc-url https://ropsten.infura.io/v3/9a1eacc6b18f436dab839c1713616fd1 \
--constructor-args 0x8c7C1F786dA4DEe7d4bB49697A9B0C0c8Fb328e0 0xa9C2f675FF8290494675dF5CFc2733319EaeeFDc 0xF7B8611008Ed073Ef348FE130671688BBb20409d 0xfC3DD73e918b931be7DEfd0cc616508391bcc001 0x682b4c36a6D4749Ced8C3abF47AefDFC57A17754 \
--private-key 3c4116deff9bd023a710b33313cc4d1a360ed887e5e83650870de392fc45eb28 \
--libraries /Users/haythem96/Projects/DeFi/Options/Opyn/squeeth-monorepo/packages/hardhat/contracts/periphery/lib/ControllerHelperUtil.sol:ControllerHelperUtil:0x7a29594866CF3383555b8e051C80142e86d1058C \
--verify --etherscan-api-key PSW8C433Q667DVEX5BCRMGNAH9FSGFZ7Q8 contracts/periphery/ControllerHelper.sol:ControllerHelper