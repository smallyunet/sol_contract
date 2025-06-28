use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo, Token, TokenAccount, Mint};

declare_id!("CFXzAhGKEz7tSFdNcVeCX8HosFGYczD7rZyD4vwoWozY");

#[program]
pub mod usdt_spl {
    use super::*;

    pub fn mint_to(ctx: Context<MintToCtx>, amount: u64) -> Result<()> {
        token::mint_to((&*ctx.accounts).into(), amount)
    }
}

#[derive(Accounts)]
pub struct MintToCtx<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>, 

    #[account(mut)]
    pub to:   Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> From<&MintToCtx<'info>> for CpiContext<'_, '_, '_, 'info, MintTo<'info>>
{
    fn from(accts: &MintToCtx<'info>) -> Self {
        let cpi_accounts = MintTo {
            mint:      accts.mint.to_account_info(),
            to:        accts.to.to_account_info(),
            authority: accts.authority.to_account_info(),
        };
        CpiContext::new(accts.token_program.to_account_info(), cpi_accounts)
    }
}
