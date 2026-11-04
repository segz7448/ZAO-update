/**
 * Country flag marks as react-native-svg geometry — never emoji.
 * Simplified / stylized for 24–40px tiles.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Circle, G } from 'react-native-svg';

const FLAG = {
  US: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="40" fill="#B22234" />
      {[0,1,2,3,4,5,6].map((i) => (
        <Rect key={i} y={i * (40 / 13) * 2} width="60" height={40 / 13} fill="#fff" />
      ))}
      <Rect width="24" height="21.5" fill="#3C3B6E" />
    </Svg>
  ),
  GB: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="40" fill="#012169" />
      <Path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
      <Path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="4" />
      <Path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="12" />
      <Path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="6" />
    </Svg>
  ),
  DE: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="13.34" fill="#000" />
      <Rect y="13.34" width="60" height="13.34" fill="#D00" />
      <Rect y="26.68" width="60" height="13.34" fill="#FFCE00" />
    </Svg>
  ),
  JP: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="40" fill="#fff" />
      <Circle cx="30" cy="20" r="10" fill="#BC002D" />
    </Svg>
  ),
  SG: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="20" fill="#ED2939" />
      <Rect y="20" width="60" height="20" fill="#fff" />
      <Circle cx="14" cy="10" r="6" fill="#fff" />
      <Circle cx="16.5" cy="10" r="5" fill="#ED2939" />
    </Svg>
  ),
  CA: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="15" height="40" fill="#FF0000" />
      <Rect x="45" width="15" height="40" fill="#FF0000" />
      <Rect x="15" width="30" height="40" fill="#fff" />
      <Path d="M30 8 L33 16 L42 16 L35 22 L38 32 L30 26 L22 32 L25 22 L18 16 L27 16 Z" fill="#FF0000" />
    </Svg>
  ),
  AU: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="40" fill="#00008B" />
      <Rect width="30" height="20" fill="#012169" />
      <Path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth="3" />
      <Path d="M15 0 V20 M0 10 H30" stroke="#fff" strokeWidth="5" />
      <Path d="M15 0 V20 M0 10 H30" stroke="#C8102E" strokeWidth="2.5" />
      <Circle cx="45" cy="22" r="2" fill="#fff" />
      <Circle cx="50" cy="28" r="1.5" fill="#fff" />
      <Circle cx="40" cy="30" r="1.5" fill="#fff" />
    </Svg>
  ),
  NL: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="13.34" fill="#AE1C28" />
      <Rect y="13.34" width="60" height="13.34" fill="#fff" />
      <Rect y="26.68" width="60" height="13.34" fill="#21468B" />
    </Svg>
  ),

  FR: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="20" height="40" fill="#002395" />
      <Rect x="20" width="20" height="40" fill="#fff" />
      <Rect x="40" width="20" height="40" fill="#ED2939" />
    </Svg>
  ),
  IN: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="13.34" fill="#FF9933" />
      <Rect y="13.34" width="60" height="13.34" fill="#fff" />
      <Rect y="26.68" width="60" height="13.34" fill="#138808" />
      <Circle cx="30" cy="20" r="4" fill="none" stroke="#000080" strokeWidth="1.2" />
    </Svg>
  ),
  BR: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="40" fill="#009C3B" />
      <Path d="M30 6 L54 20 L30 34 L6 20 Z" fill="#FFDF00" />
      <Circle cx="30" cy="20" r="7" fill="#002776" />
    </Svg>
  ),
  MX: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="20" height="40" fill="#006847" />
      <Rect x="20" width="20" height="40" fill="#fff" />
      <Rect x="40" width="20" height="40" fill="#CE1126" />
      <Circle cx="30" cy="20" r="4" fill="#8B4513" />
    </Svg>
  ),
  IE: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="20" height="40" fill="#169B62" />
      <Rect x="20" width="20" height="40" fill="#fff" />
      <Rect x="40" width="20" height="40" fill="#FF883E" />
    </Svg>
  ),
  ES: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="10" fill="#AA151B" />
      <Rect y="10" width="60" height="20" fill="#F1BF00" />
      <Rect y="30" width="60" height="10" fill="#AA151B" />
    </Svg>
  ),
  IT: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="20" height="40" fill="#009246" />
      <Rect x="20" width="20" height="40" fill="#fff" />
      <Rect x="40" width="20" height="40" fill="#CE2B37" />
    </Svg>
  ),
  KR: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="40" fill="#fff" />
      <Circle cx="30" cy="20" r="8" fill="#CD2E3A" />
      <Path d="M30 20 a8 8 0 0 1 0 0.01 a4 8 0 0 0 0 -0.01" fill="#0047A0" />
      <Circle cx="30" cy="20" r="4" fill="#0047A0" />
      <Circle cx="30" cy="16" r="4" fill="#CD2E3A" />
    </Svg>
  ),
  NZ: ({ w, h }) => (
    <Svg width={w} height={h} viewBox="0 0 60 40">
      <Rect width="60" height="40" fill="#00247D" />
      <Rect width="30" height="20" fill="#012169" />
      <Path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth="3" />
      <Path d="M15 0 V20 M0 10 H30" stroke="#fff" strokeWidth="5" />
      <Path d="M15 0 V20 M0 10 H30" stroke="#C8102E" strokeWidth="2.5" />
      <Circle cx="42" cy="22" r="2" fill="#C8102E" />
      <Circle cx="48" cy="28" r="1.5" fill="#C8102E" />
    </Svg>
  ),

};

export function CountryFlag({ code, size = 28, style }) {
  const cc = String(code || '').toUpperCase();
  const Comp = FLAG[cc];
  const w = size * 1.5;
  const h = size;
  const r = Math.round(size * 0.22);
  return (
    <View
      accessibilityLabel={`${cc} flag`}
      style={[{
        width: w, height: h, borderRadius: r, overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.35)',
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }, elevation: 2,
      }, style]}
    >
      {Comp ? <Comp w={w} h={h} /> : (
        <Svg width={w} height={h} viewBox="0 0 60 40">
          <Rect width="60" height="40" fill="#8E8E93" />
        </Svg>
      )}
    </View>
  );
}

export const FLAG_CODES = Object.keys(FLAG);
