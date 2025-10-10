echo "==========  cloc ==========="
cloc . --vcs=git --exclude-dir=node_modules,dist,build --include-lang=TypeScript,Solidity

echo
echo
echo "=========  tokei =========="
tokei .

echo
echo
echo "=========  scc  ==========="
scc . --exclude-ext json,html,xml,js,csv,bash
