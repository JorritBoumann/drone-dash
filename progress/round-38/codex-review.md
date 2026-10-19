No concrete bug found in the requested `git diff HEAD -- src index.html`.

The water shader additions avoid the listed NaN/Inf hazards: their smoothstep ranges are nonzero, and I found no new negative-base `pow` or zero-vector normalization. The HUD placement adds layout reads only when a pop is placed or the measured layout changes, not every frame.

The rib boat geometry is not present in that diff, so I couldn’t review it.