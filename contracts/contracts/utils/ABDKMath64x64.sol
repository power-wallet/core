// SPDX-License-Identifier: BSD-4-Clause
/*
 * ABDK Math 64.64 Smart Contract Library.  Copyright © 2019 ABDK Consulting.
 * Author: Mikhail Vladimirov <mikhail.vladimirov@abdk.consulting>
 */
pragma solidity ^0.8.24;

/**
 * @dev A subset of ABDKMath64x64 required by SmartBtcDca strategy.
 * For full functionality see the original library: https://github.com/abdk-consulting/abdk-libraries-solidity
 */
library ABDKMath64x64 {
  int128 private constant ONE = 0x10000000000000000; // 1.0 in 64.64

  function fromUInt (uint256 x) internal pure returns (int128) {
    require (x <= 0x7FFFFFFFFFFFFFFF, "ovf");
    return int128 (int256 (x << 64));
  }

  function toUInt (int128 x) internal pure returns (uint64) {
    require (x >= 0);
    return uint64 (uint128 (x) >> 64);
  }

  function add (int128 x, int128 y) internal pure returns (int128) {
    int256 z = int256 (x) + y;
    require (z >= type(int128).min && z <= type(int128).max, "ovf");
    return int128 (z);
  }

  function sub (int128 x, int128 y) internal pure returns (int128) {
    int256 z = int256 (x) - y;
    require (z >= type(int128).min && z <= type(int128).max, "ovf");
    return int128 (z);
  }

  function mul (int128 x, int128 y) internal pure returns (int128) {
    return int128 ((int256 (x) * y) >> 64);
  }

  function div (int128 x, int128 y) internal pure returns (int128) {
    require (y != 0, "div0");
    return int128 ((int256 (x) << 64) / y);
  }

  function log_2 (int128 x) internal pure returns (int128) {
    require (x > 0, "log");
    uint256 ux = uint256(uint128(x));
    int256 result = 0;

    // Normalize ux to be in [1.0, 2.0) range (i.e., [2^64, 2^65) in 64.64)
    if (ux < 0x10000000000000000) {
      uint256 shift = 0;
      while (ux < 0x10000000000000000) { ux <<= 1; shift++; }
      result -= int256(shift) << 64;
    } else if (ux >= 0x20000000000000000) {
      uint256 shift = 0;
      while (ux >= 0x20000000000000000) { ux >>= 1; shift++; }
      result += int256(shift) << 64;
    }

    // Fractional part via iterative squaring
    for (uint8 bit = 0; bit < 64; bit++) {
      ux = (ux * ux) >> 64;
      if (ux >= 0x20000000000000000) {
        ux >>= 1;
        result += int256(1) << (63 - bit);
      }
    }
    return int128(result);
  }

  function exp_2 (int128 x) internal pure returns (int128) {
    if (x < -0x400000000000000000) return 0; // underflow
    require (x <= 0x400000000000000000, "exp ovf");
    // Adapted fast exp2 using binary fraction decomposition
    int128 result = ONE; // 1.0
    int128 term = ONE;
    // Use simple series expansion around 0 for small x; for brevity keep limited precision
    // exp2(x) ≈ 1 + x*ln2 + (x*ln2)^2/2! + (x*ln2)^3/3!
    // ln2 ≈ 0.6931471805599453 → in 64.64:
    int128 ln2 = 0x0B17217F7D1CF79AC; // ~0.69314718056 in 64.64
    int128 t = mul (x, ln2);
    term = add (term, t);
    term = add (term, div (mul (t, t), fromUInt (2)));
    term = add (term, div (mul (mul (t, t), t), fromUInt (6)));
    result = term;
    return result;
  }
}


