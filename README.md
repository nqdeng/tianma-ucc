tianma-ucc
==========

The Pegasus module wrapper for UCC

`tianma-ucc`作为Pegasus的一条管道，用于实时编译文件供unicorn管道使用。

## 文件目录

- htdocs
    - group
        - project
            - 1.0.0
                - src
                    a.js
                - package.json

## 访问流程

    http://localhost/group/project/1.0.0/a.js


tianma-ucc解析URL，获取base路径为`group/project/1.0.0`
根据base路径获取package.json，解析package.json中的配置选项用于UCC实时编译。

如果package.json中的source配置为`src`，那么实际上访问的是以下文件路径：

    http://localhost/group/project/1.0.0/src/a.js

## 没有package.json的情况

默认source为当前路径。

## package.json的查找规则

根据base依次向上查找，比如当前base为`group/project/1.0.0`，如果当前base下无法获取package.json，则设置base为
`group/project`，直至根目录。

