<?php

namespace App\Repository;

use App\Entity\Feed;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Feed>
 */
class FeedRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Feed::class);
    }
    public function findOneByUserIdWithItemsAndVideos(int $userId): ?Feed
    {
        return $this->createQueryBuilder('f')
            ->innerJoin('f.user', 'u')
            ->leftJoin('f.feedItems', 'fi')
            ->addSelect('fi')
            ->leftJoin('fi.video', 'v')
            ->addSelect('v')
            ->andWhere('u.id = :uid')
            ->setParameter('uid', $userId)
            ->orderBy('fi.score', 'DESC')
            ->addOrderBy('fi.createdAt', 'DESC')
            ->getQuery()
            ->getOneOrNullResult();
    }


    //    /**
    //     * @return Feed[] Returns an array of Feed objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('f')
    //            ->andWhere('f.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('f.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?Feed
    //    {
    //        return $this->createQueryBuilder('f')
    //            ->andWhere('f.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
