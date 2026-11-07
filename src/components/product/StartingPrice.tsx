import type { CSSProperties } from 'react';
import { productPriceBasis, productPriceLabel } from '../../utils/publicProductPrice';

/** Public catalogue prices always keep their headcount condition beside the amount. */
export function StartingPrice({ product, amountStyle, basisStyle }: { product: unknown; amountStyle?: CSSProperties; basisStyle?: CSSProperties }) {
    const basis = productPriceBasis(product);
    return <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={amountStyle}>{productPriceLabel(product)}</span>
        {basis && <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: '#71807C', ...basisStyle }}>{basis}</span>}
    </span>;
}
